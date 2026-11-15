import {
  facilityStaff,
  staffOnShiftFor,
} from '@modules/inspection/handover-assignment/assignment-queries';
import { nextInRotation } from '@modules/inspection/handover-assignment/handover-rotation';
import type { NotificationsService } from '@modules/notifications/notifications.service';
import { Logger } from '@nestjs/common';
import { NotificationType } from '@storage/types';
import type { EntityManager } from 'typeorm';
import { loadDropOffRequests } from './drop-off-request.read';
import { findFacilityStaffIds } from './facility-staff.query';
import { loadPickupRequests } from './pickup-request.read';
import { linesSummary, timeVi } from './shelf-rules';

export type ShelfRequestKind = 'PICKUP' | 'DROP_OFF';

const TABLE: Record<ShelfRequestKind, string> = {
  PICKUP: 'pickup_requests',
  DROP_OFF: 'drop_off_requests',
};
const OPEN: Record<ShelfRequestKind, string> = {
  PICKUP: `('PENDING','READY')`,
  DROP_OFF: `('PENDING','CONFIRMED')`,
};

/** The shelf's warehouse decides the facility; joins shared by every query here. */
const FACILITY_JOIN = `
  JOIN "contracts" c ON c."id" = r."contract_id"
  JOIN "booking_items" bi ON bi."id" = c."booking_item_id"
  JOIN "storage_units" u ON u."id" = bi."storage_unit_id"
  JOIN "storage_units" w ON w."id" = u."parent_id"`;

const logger = new Logger('ShelfRequestAssignment');

/**
 * Gives an open, unassigned pick-up or drop-off request to a staff member of its facility whose
 * shift covers `requestedFor`, round robin by name after whoever was given that kind of request
 * last — the rotation of handovers and returns. Only the assignee is told; anyone at the facility
 * may still serve the request. Returns the assignee, or null when nobody is on shift then (the
 * caller tells the whole branch instead) or the request is no longer open or already assigned.
 *
 * The row is locked first, skipping one locked elsewhere: the creating transaction already holds
 * it, and the shift-added sweep must not wait on a request a customer is cancelling.
 */
export async function assignShelfRequest(
  em: EntityManager,
  kind: ShelfRequestKind,
  requestId: string,
  notifications: Pick<NotificationsService, 'createForUsers'>,
): Promise<string | null> {
  const [row]: { requestedFor: Date; facilityId: string }[] = await em.query(
    `SELECT r."requested_for" AS "requestedFor", w."facility_id" AS "facilityId"
       FROM "${TABLE[kind]}" r ${FACILITY_JOIN}
      WHERE r."id" = $1 AND r."assigned_to" IS NULL AND r."status" IN ${OPEN[kind]}
      FOR UPDATE OF r SKIP LOCKED`,
    [requestId],
  );
  if (!row) return null;

  // Two requests made at once must not both read the same "last assigned" person.
  await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `shelf_${kind.toLowerCase()}_rotation:${row.facilityId}`,
  ]);
  const staff = await facilityStaff(em, row.facilityId);
  const onShift = await staffOnShiftFor(em, row.facilityId, staff, [new Date(row.requestedFor)]);
  const staffId = nextInRotation(staff, await lastAssigned(em, kind, row.facilityId), onShift);
  if (!staffId) return null;

  await em.query(
    `UPDATE "${TABLE[kind]}" SET "assigned_to" = $2, "assigned_at" = now() WHERE "id" = $1`,
    [requestId, staffId],
  );
  await notifyAssignee(em, kind, requestId, staffId, row.facilityId, notifications);
  return staffId;
}

/**
 * `assignShelfRequest` in a savepoint that never throws: a failed assignment only leaves the
 * request to the branch; it must not undo the request or the shift write it runs inside.
 */
export async function assignShelfRequestSafely(
  em: EntityManager,
  kind: ShelfRequestKind,
  requestId: string,
  notifications: Pick<NotificationsService, 'createForUsers'>,
): Promise<string | null> {
  try {
    return await em.transaction((savepoint) =>
      assignShelfRequest(savepoint, kind, requestId, notifications),
    );
  } catch (err) {
    logger.error(
      `Assigning ${kind} request ${requestId} failed; left for the branch`,
      err instanceof Error ? err.stack : String(err),
    );
    return null;
  }
}

/**
 * Open, unassigned requests of the facility due in `[from, to]`, oldest first so the rotation
 * hands them out in the order they were made. Used when shifts are added.
 */
export async function pendingShelfRequests(
  em: EntityManager,
  facilityId: string,
  from: Date,
  to: Date,
): Promise<{ kind: ShelfRequestKind; id: string }[]> {
  const found: { kind: ShelfRequestKind; id: string; createdAt: Date }[] = [];
  for (const kind of ['PICKUP', 'DROP_OFF'] as const) {
    const rows: { id: string; createdAt: Date }[] = await em.query(
      `SELECT r."id", r."created_at" AS "createdAt" FROM "${TABLE[kind]}" r ${FACILITY_JOIN}
        WHERE w."facility_id" = $1 AND r."assigned_to" IS NULL AND r."status" IN ${OPEN[kind]}
          AND r."requested_for" BETWEEN $2 AND $3`,
      [facilityId, from, to],
    );
    found.push(...rows.map((row) => ({ kind, ...row })));
  }
  return found
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map(({ kind, id }) => ({ kind, id }));
}

/**
 * Who hears about a request of the facility: its assignee and the managers, or every staff
 * member and manager while nobody is assigned.
 */
export async function shelfRequestRecipients(
  em: EntityManager,
  facilityId: string,
  assignedToId: string | null,
): Promise<string[]> {
  if (!assignedToId) return findFacilityStaffIds(em, facilityId);
  const managers: { userId: string }[] = await em.query(
    `SELECT DISTINCT "user_id" AS "userId" FROM "user_role_assignments"
      WHERE "role" = 'FACILITY_MANAGER' AND "facility_id" = $1
        AND "starts_at" <= now() AND ("ends_at" IS NULL OR "ends_at" > now())`,
    [facilityId],
  );
  return [...new Set([assignedToId, ...managers.map((row) => row.userId)])];
}

async function lastAssigned(
  em: EntityManager,
  kind: ShelfRequestKind,
  facilityId: string,
): Promise<string | null> {
  const [last]: { staffId: string }[] = await em.query(
    `SELECT r."assigned_to" AS "staffId" FROM "${TABLE[kind]}" r ${FACILITY_JOIN}
      WHERE w."facility_id" = $1 AND r."assigned_to" IS NOT NULL
      ORDER BY r."assigned_at" DESC, r."id" DESC LIMIT 1`,
    [facilityId],
  );
  return last?.staffId ?? null;
}

async function notifyAssignee(
  em: EntityManager,
  kind: ShelfRequestKind,
  requestId: string,
  staffId: string,
  facilityId: string,
  notifications: Pick<NotificationsService, 'createForUsers'>,
): Promise<void> {
  if (kind === 'PICKUP') {
    const [request] = await loadPickupRequests(em, { ids: [requestId], order: 'newest' });
    await notifications.createForUsers(em, [staffId], {
      type: NotificationType.PICKUP_REQUEST_CREATED,
      title: 'Bạn được giao yêu cầu lấy đồ',
      body: `Chuẩn bị ${linesSummary(request.lines)} ở kệ ${request.shelf.code} cho ${
        request.customer.fullName ?? 'khách'
      } lúc ${timeVi(new Date(request.requestedFor))}`,
      data: { pickupRequestId: requestId, warehouseId: request.warehouse.id, facilityId },
    });
    return;
  }
  const [request] = await loadDropOffRequests(em, { ids: [requestId], order: 'newest' });
  await notifications.createForUsers(em, [staffId], {
    type: NotificationType.DROP_OFF_REQUEST_CREATED,
    title: 'Bạn được giao yêu cầu gửi đồ',
    body: `${request.customer.fullName ?? 'Khách'} sẽ gửi ${linesSummary(request.lines)} vào kệ ${
      request.shelf.code
    } lúc ${timeVi(new Date(request.requestedFor))}`,
    data: { dropOffRequestId: requestId, warehouseId: request.warehouse.id, facilityId },
  });
}
