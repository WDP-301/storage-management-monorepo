import { Contract } from '@entities/contract.entity';
import type { NotificationsService } from '@modules/notifications/notifications.service';
import { Logger } from '@nestjs/common';
import { ContractStatus, InspectionType, StorageUnitKind } from '@storage/types';
import { type EntityManager, In, IsNull } from 'typeorm';
import { facilityStaff, staffOnShiftFor } from './assignment-queries';
import { shelfContractAssignedNotification } from './handover-assigned.notification';
import { nextInRotation } from './handover-rotation';

const logger = new Logger('ShelfContractAssignment');

/**
 * DRAFT shelf contracts the counter signs: no handover inspection (a shelf rented before shelves
 * dropped it, or a unit change's destination, is assigned through that handover instead).
 */
function shelfDrafts(em: EntityManager) {
  return em
    .createQueryBuilder(Contract, 'c')
    .innerJoinAndSelect('c.bookingItem', 'item')
    .innerJoinAndSelect('item.storageUnit', 'unit')
    .where('c.status = :draft', { draft: ContractStatus.DRAFT })
    .andWhere('unit.kind = :shelf', { shelf: StorageUnitKind.SHELF })
    .andWhere(
      `NOT EXISTS (SELECT 1 FROM "inspections" i
                    WHERE i."contract_id" = c."id" AND i."type" = :handover)`,
      { handover: InspectionType.PRE_HANDOVER },
    );
}

function byFacility(contracts: Contract[]): Map<string, Contract[]> {
  const groups = new Map<string, Contract[]>();
  for (const contract of contracts) {
    const facilityId = contract.bookingItem.storageUnit.facilityId;
    groups.set(facilityId, [...(groups.get(facilityId) ?? []), contract]);
  }
  return groups;
}

/** Staff member of the facility's most recently assigned shelf contract. */
async function lastAssignee(em: EntityManager, facilityId: string): Promise<string | null> {
  const [row]: { staffId: string }[] = await em.query(
    `SELECT c."assigned_to" AS "staffId"
       FROM "contracts" c
       JOIN "booking_items" bi ON bi."id" = c."booking_item_id"
       JOIN "storage_units" u ON u."id" = bi."storage_unit_id"
      WHERE c."assigned_to" IS NOT NULL AND u."facility_id" = $1
      ORDER BY c."assigned_at" DESC
      LIMIT 1`,
    [facilityId],
  );
  return row?.staffId ?? null;
}

/**
 * Gives the unassigned shelf contracts of a booking to one staff member per facility, round robin
 * by name among the staff whose shifts cover every booked start time there — the handover
 * rotation, kept separately. Nobody on shift leaves them for the shift-added sweep or a manager.
 */
export async function assignShelfContracts(
  em: EntityManager,
  bookingId: string,
  notifications: Pick<NotificationsService, 'createForUsers'>,
): Promise<void> {
  const contracts = await shelfDrafts(em)
    .andWhere('item.bookingId = :bookingId', { bookingId })
    .andWhere('c.assignedTo IS NULL')
    .orderBy('c.effectiveAt', 'ASC')
    .getMany();

  for (const [facilityId, group] of byFacility(contracts)) {
    // Two deposits confirmed at once must not both read the same "last assigned" person.
    await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `shelf_contract_rotation:${facilityId}`,
    ]);
    const times = group.map((contract) => contract.effectiveAt);
    const staff = await facilityStaff(em, facilityId);
    const onShift = await staffOnShiftFor(em, facilityId, staff, times);
    const staffId = nextInRotation(staff, await lastAssignee(em, facilityId), onShift);
    if (!staffId) {
      logger.warn(`No staff on shift at facility ${facilityId} for the shelves of ${bookingId}`);
      continue;
    }

    const contractIds = group.map((contract) => contract.id);
    await em.update(
      Contract,
      { id: In(contractIds), assignedTo: IsNull() },
      { assignedTo: staffId, assignedAt: new Date() },
    );
    await notifications.createForUsers(
      em,
      [staffId],
      shelfContractAssignedNotification({
        bookingId,
        facilityId,
        contractIds,
        shelfCodes: group.map((contract) => contract.bookingItem.storageUnit.code),
        firstVisitAt: times[0],
      }),
    );
  }
}

/** Bookings with an unassigned shelf contract at the facility booked to start in `[from, to]`. */
export async function pendingShelfContractBookings(
  em: EntityManager,
  facilityId: string,
  from: Date,
  to: Date,
): Promise<string[]> {
  const contracts = await shelfDrafts(em)
    .andWhere('unit.facilityId = :facilityId', { facilityId })
    .andWhere('c.assignedTo IS NULL')
    .andWhere('c.effectiveAt BETWEEN :from AND :to', { from, to })
    // Oldest first, so the rotation hands them out in the order they were booked.
    .orderBy('c.createdAt', 'ASC')
    .getMany();
  return [...new Set(contracts.map((contract) => contract.bookingItem.bookingId))];
}

/**
 * Releases the shelf contracts `staffId` holds at the facility, booked to start in `[from, to]`,
 * that no working shift of theirs covers any more — unless the signed files are already in, then
 * they keep it. Returns the bookings released, for the caller to re-run the rotation on.
 */
export async function releaseUncoveredShelfContracts(
  em: EntityManager,
  facilityId: string,
  staffId: string,
  from: Date,
  to: Date,
): Promise<string[]> {
  const contracts = await shelfDrafts(em)
    .andWhere('unit.facilityId = :facilityId', { facilityId })
    .andWhere('c.assignedTo = :staffId', { staffId })
    .andWhere('c.effectiveAt BETWEEN :from AND :to', { from, to })
    .getMany();

  const byBooking = new Map<string, Contract[]>();
  for (const contract of contracts) {
    const bookingId = contract.bookingItem.bookingId;
    byBooking.set(bookingId, [...(byBooking.get(bookingId) ?? []), contract]);
  }

  const released: string[] = [];
  for (const [bookingId, group] of byBooking) {
    if (group.some((contract) => contract.documents?.length)) continue;
    const covered = await staffOnShiftFor(
      em,
      facilityId,
      [{ id: staffId, fullName: '' }],
      group.map((contract) => contract.effectiveAt),
    );
    if (covered.has(staffId)) continue;
    await em.update(
      Contract,
      { id: In(group.map((contract) => contract.id)), assignedTo: staffId },
      { assignedTo: null, assignedAt: null },
    );
    released.push(bookingId);
  }
  return released;
}
