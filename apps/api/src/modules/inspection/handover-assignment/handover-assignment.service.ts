import { Inspection } from '@entities/inspection.entity';
import { StaffShift } from '@entities/staff-shift.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { isAssignmentActive } from '@modules/auth/role-assignment.util';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { Injectable, Logger } from '@nestjs/common';
import { InspectionType, StaffShiftStatus, UserRole, UserStatus } from '@storage/types';
import { Between, type EntityManager, In, IsNull, LessThanOrEqual, MoreThan, Not } from 'typeorm';
import { handoverAssignedNotification } from './handover-assigned.notification';
import { nextInRotation, staffOnShiftAt } from './handover-rotation';

/** Shifts the staff member can still be working: not ended by a check-out, absence or cancel. */
const WORKING = [StaffShiftStatus.SCHEDULED, StaffShiftStatus.CHECKED_IN];

interface RotationMember {
  id: string;
  fullName: string;
}

/**
 * Gives the handovers of a confirmed booking to one staff member per facility, round robin by
 * name among the staff whose shifts cover every handover time of that booking at that facility.
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
   * Re-runs the round-robin assignment for every still-unassigned handover of `facilityId` whose
   * appointment falls in `[from, to)`. Called when staff shifts are added, so a handover left for
   * a manager while nobody was on shift is taken as soon as the shift exists. Returns how many
   * bookings were re-visited.
   */
  async assignPendingForFacility(
    em: EntityManager,
    facilityId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const pending = await em.find(Inspection, {
      where: {
        type: InspectionType.PRE_HANDOVER,
        inspectedBy: IsNull(),
        scheduledAt: Between(from, to),
        contract: { bookingItem: { storageUnit: { facilityId } } },
      },
      relations: { contract: { bookingItem: { storageUnit: true } } },
    });
    const bookingIds = [...new Set(pending.map((row) => row.contract.bookingItem.bookingId))];
    for (const bookingId of bookingIds) await this.assignSafely(em, bookingId);
    return bookingIds.length;
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
    const staff = await this.facilityStaff(em, facilityId);
    if (staff.length === 0) return null;

    const earliest = new Date(Math.min(...times.map(Number)));
    const latest = new Date(Math.max(...times.map(Number)));
    const shifts = await em.find(StaffShift, {
      where: {
        facilityId,
        staffId: In(staff.map((member) => member.id)),
        status: In(WORKING),
        startAt: LessThanOrEqual(latest),
        endAt: MoreThan(earliest),
      },
    });
    const onShift = staffOnShiftAt(shifts, times);
    if (onShift.size === 0) return null;

    return nextInRotation(staff, await this.lastAssignedStaffId(em, facilityId), onShift);
  }

  /** Active staff of the facility in rotation order: by name, then id for equal names. */
  private async facilityStaff(em: EntityManager, facilityId: string): Promise<RotationMember[]> {
    const assignments = await em.find(UserRoleAssignment, {
      where: { facilityId, role: UserRole.FACILITY_STAFF, user: { status: UserStatus.ACTIVE } },
      relations: { user: true },
    });
    const staff = new Map<string, RotationMember>();
    for (const assignment of assignments) {
      if (!isAssignmentActive(assignment) || !assignment.user) continue;
      const { id, fullName } = assignment.user;
      staff.set(id, { id, fullName });
    }
    return [...staff.values()].sort(
      (a, b) => a.fullName.localeCompare(b.fullName, 'vi') || a.id.localeCompare(b.id),
    );
  }

  /** Staff member of the facility's most recently created handover that has someone on it. */
  private async lastAssignedStaffId(em: EntityManager, facilityId: string): Promise<string | null> {
    const last = await em.findOne(Inspection, {
      where: {
        type: InspectionType.PRE_HANDOVER,
        inspectedBy: Not(IsNull()),
        contract: { bookingItem: { storageUnit: { facilityId } } },
      },
      relations: { contract: { bookingItem: { storageUnit: true } } },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return last?.inspectedBy ?? null;
  }
}
