import { Inspection } from '@entities/inspection.entity';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { Injectable, Logger } from '@nestjs/common';
import { InspectionType, NotificationType } from '@storage/types';
import { Between, type EntityManager, In, IsNull } from 'typeorm';
import { facilityStaff, lastAssignedStaffId, staffOnShiftFor } from './assignment-queries';
import { handoverAssignedNotification } from './handover-assigned.notification';
import { nextInRotation } from './handover-rotation';
import { assignReturn } from './return-assignment';

/**
 * Gives the handovers of a confirmed booking to one staff member per facility, round robin by
 * name among the staff whose shifts cover every handover time of that booking at that facility.
 * Returns go the same way, one appointment at a time.
 */
@Injectable()
export class HandoverAssignmentService {
  private readonly logger = new Logger(HandoverAssignmentService.name);

  constructor(private readonly notifications: NotificationsService) {}

  /**
   * Runs inside the caller's transaction, in a savepoint, and never throws: a failure only leaves
   * the handovers unassigned for a manager; it must not undo the confirmed deposit.
   */
  async assignSafely(em: EntityManager, bookingId: string): Promise<void> {
    try {
      await em.transaction((savepoint) => this.assign(savepoint, bookingId));
    } catch (err) {
      this.logger.error(
        `Assigning the handovers of booking ${bookingId} failed; left for a manager`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Gives an open return to staff on shift at its appointment (see `assignReturn`); `moved` when
   * its appointment just changed, so its inspector is told. Runs in a savepoint and never throws:
   * a failure only leaves the return for a manager; it must not undo the request or reschedule it
   * runs inside. Returns the inspector, or null when unassigned.
   */
  async assignReturnSafely(
    em: EntityManager,
    inspectionId: string,
    moved = false,
  ): Promise<string | null> {
    try {
      return await em.transaction((savepoint) =>
        assignReturn(savepoint, inspectionId, this.notifications, moved),
      );
    } catch (err) {
      this.logger.error(
        `Assigning return ${inspectionId} failed; left for a manager`,
        err instanceof Error ? err.stack : String(err),
      );
      return null;
    }
  }

  /**
   * Assigns a maintenance check of a vacated unit to a staff member of THAT unit's facility, round
   * robin by name. No customer is met, so no shift has to cover the time — every active staff
   * member of the facility is eligible. Returns the chosen staff id, or null when the facility has
   * no staff left for a manager.
   */
  async assignMaintenanceInspection(
    em: EntityManager,
    inspectionId: string,
  ): Promise<string | null> {
    const inspection = await em.findOne(Inspection, {
      where: { id: inspectionId },
      relations: { contract: { bookingItem: { storageUnit: true } } },
    });
    if (!inspection || inspection.type !== InspectionType.MAINTENANCE) return null;
    if (inspection.inspectedBy) return inspection.inspectedBy;

    const unit = inspection.contract?.bookingItem?.storageUnit;
    const facilityId = unit?.facilityId;
    if (!facilityId) return null;

    const staff = await facilityStaff(em, facilityId);
    if (staff.length === 0) {
      this.logger.warn(
        `No staff at facility ${facilityId} to check the maintenance of ${unit?.code ?? '?'}`,
      );
      return null;
    }

    await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `handover_rotation:${facilityId}`,
    ]);
    const staffId = nextInRotation(
      staff,
      await lastAssignedStaffId(em, facilityId, InspectionType.MAINTENANCE),
      new Set(staff.map((member) => member.id)),
    );
    if (!staffId) return null;

    await em.update(Inspection, { id: inspection.id }, { inspectedBy: staffId });
    await this.notifications.createForUsers(em, [staffId], {
      type: NotificationType.MAINTENANCE_CHECK_DUE,
      title: 'Bạn được phân công kiểm tra kho',
      body:
        `Kho ${unit?.code ?? ''} đã trống sau khi khách chuyển đi — kiểm tra và chốt biên bản ` +
        'bảo trì.',
      data: {
        inspectionId: inspection.id,
        contractId: inspection.contractId,
        unitCode: unit?.code ?? null,
      },
    });
    return staffId;
  }

  /**
   * Re-runs the round-robin assignment for every still-unassigned handover and open return of
   * `facilityId` whose appointment falls in `[from, to]`. Called when staff shifts are added, so
   * an appointment left for a manager while nobody was on shift is taken as soon as the shift
   * exists. Never throws — a failure only leaves it unassigned — so it cannot undo the shift
   * write it runs inside. Returns how many bookings and returns were re-visited.
   */
  async assignPendingForFacility(
    em: EntityManager,
    facilityId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    let bookingIds: string[];
    let returnIds: string[];
    try {
      const pending = await em.find(Inspection, {
        where: {
          type: In([InspectionType.PRE_HANDOVER, InspectionType.RETURN]),
          inspectedBy: IsNull(),
          finalizedAt: IsNull(),
          scheduledAt: Between(from, to),
          contract: { bookingItem: { storageUnit: { facilityId } } },
        },
        relations: { contract: { bookingItem: { storageUnit: true } } },
        // Oldest first, so the rotation hands them out in the order they were requested.
        order: { createdAt: 'ASC', id: 'ASC' },
      });
      const handovers = pending.filter((row) => row.type === InspectionType.PRE_HANDOVER);
      bookingIds = [...new Set(handovers.map((row) => row.contract.bookingItem.bookingId))];
      returnIds = pending.filter((row) => row.type === InspectionType.RETURN).map((row) => row.id);
    } catch (err) {
      this.logger.error(
        `Listing pending handovers of facility ${facilityId} failed; left for a manager`,
        err instanceof Error ? err.stack : String(err),
      );
      return 0;
    }
    for (const bookingId of bookingIds) await this.assignSafely(em, bookingId);
    for (const returnId of returnIds) await this.assignReturnSafely(em, returnId);
    return bookingIds.length + returnIds.length;
  }

  private async assign(em: EntityManager, bookingId: string): Promise<void> {
    const handovers = await em.find(Inspection, {
      where: {
        type: InspectionType.PRE_HANDOVER,
        inspectedBy: IsNull(),
        contract: { bookingItem: { bookingId } },
      },
      relations: { contract: { bookingItem: { storageUnit: true } } },
      order: { scheduledAt: 'ASC' },
    });

    const byFacility = new Map<string, Inspection[]>();
    for (const handover of handovers) {
      const facilityId = handover.contract.bookingItem.storageUnit.facilityId;
      byFacility.set(facilityId, [...(byFacility.get(facilityId) ?? []), handover]);
    }

    for (const [facilityId, group] of byFacility) {
      // Two deposits confirmed at once must not both read the same "last assigned" person.
      await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `handover_rotation:${facilityId}`,
      ]);
      const times = group.map((handover) => handover.scheduledAt);
      const staffId = await this.pickStaff(em, facilityId, times);
      if (!staffId) {
        this.logger.warn(
          `No staff on shift at facility ${facilityId} for the handovers of booking ${bookingId}`,
        );
        continue;
      }

      const inspectionIds = group.map((handover) => handover.id);
      await em.update(Inspection, { id: In(inspectionIds) }, { inspectedBy: staffId });
      await this.notifications.createForUsers(
        em,
        [staffId],
        handoverAssignedNotification({
          bookingId,
          facilityId,
          inspectionIds,
          unitCodes: group.map((handover) => handover.contract.bookingItem.storageUnit.code),
          firstHandoverAt: times[0],
        }),
      );
    }
  }

  private async pickStaff(
    em: EntityManager,
    facilityId: string,
    times: Date[],
  ): Promise<string | null> {
    const staff = await facilityStaff(em, facilityId);
    if (staff.length === 0) return null;

    const onShift = await staffOnShiftFor(em, facilityId, staff, times);
    if (onShift.size === 0) return null;

    return nextInRotation(
      staff,
      await lastAssignedStaffId(em, facilityId, InspectionType.PRE_HANDOVER),
      onShift,
    );
  }
}
