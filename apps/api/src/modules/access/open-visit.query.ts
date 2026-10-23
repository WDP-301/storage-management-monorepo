import type { CheckOutMethod } from '@storage/types';
import type { EntityManager } from 'typeorm';

export type OpenVisit = { id: string; warehouseId: string; facilityId: string; usedAt: Date };

/** Condition matching an open visit on `access_events` aliased as `e`. */
export const OPEN_VISIT = `e."event_type" = 'CHECK_IN' AND e."used_at" IS NOT NULL AND e."checked_out_at" IS NULL`;

/** The customer's open visit, if any (at most one, enforced by a partial unique index). */
export async function findOpenVisit(
  em: EntityManager,
  customerId: string,
  options: { lock?: boolean } = {},
): Promise<OpenVisit | null> {
  const [visit]: OpenVisit[] = await em.query(
    `SELECT e."id", e."warehouse_id" AS "warehouseId", e."facility_id" AS "facilityId",
            e."used_at" AS "usedAt"
       FROM "access_events" e
      WHERE e."customer_id" = $1 AND ${OPEN_VISIT}
      ${options.lock ? 'FOR UPDATE' : ''}`,
    [customerId],
  );
  return visit ?? null;
}

/**
 * Closes one open visit; a no-op when it was closed meanwhile. Returns whether it closed it.
 * The exit time is the wall clock, like the scan that consumes a pass.
 */
export async function closeVisit(
  em: EntityManager,
  visitId: string,
  close: {
    method: CheckOutMethod;
    by: string | null;
    note?: string | null;
    checkOutEventId?: string | null;
  },
): Promise<Date | null> {
  const [rows]: [{ checkedOutAt: Date }[], number] = await em.query(
    `UPDATE "access_events" e
        SET "checked_out_at" = clock_timestamp(), "checked_out_by" = $2,
            "check_out_method" = $3, "check_out_note" = $4, "check_out_event_id" = $5
      WHERE e."id" = $1 AND ${OPEN_VISIT}
      RETURNING e."checked_out_at" AS "checkedOutAt"`,
    [visitId, close.by, close.method, close.note ?? null, close.checkOutEventId ?? null],
  );
  return rows[0]?.checkedOutAt ?? null;
}

/**
 * How long after a visit was closed without a scan (closing-time sweep, manual check-out) the
 * customer's next scan at that warehouse still counts as their way out.
 */
export const LATE_EXIT_WINDOW_MINUTES = 120;

/**
 * The customer's latest visit when it was closed without a scan within the late-exit window and
 * no exit scan was recorded on it since — at `warehouseId` when given. Locked when asked.
 */
export async function findLateExitVisit(
  em: EntityManager,
  customerId: string,
  options: { warehouseId?: string; lock?: boolean } = {},
): Promise<OpenVisit | null> {
  const [visit]: (OpenVisit & { lateExit: boolean })[] = await em.query(
    `SELECT e."id", e."warehouse_id" AS "warehouseId", e."facility_id" AS "facilityId",
            e."used_at" AS "usedAt",
            (e."checked_out_at" IS NOT NULL AND e."check_out_method" <> 'SCAN'
              AND e."check_out_event_id" IS NULL
              AND e."checked_out_at" > clock_timestamp() - make_interval(mins => $2)) AS "lateExit"
       FROM "access_events" e
      WHERE e."customer_id" = $1 AND e."event_type" = 'CHECK_IN' AND e."used_at" IS NOT NULL
      ORDER BY e."used_at" DESC
      LIMIT 1
      ${options.lock ? 'FOR UPDATE' : ''}`,
    [customerId, LATE_EXIT_WINDOW_MINUTES],
  );
  if (!visit?.lateExit) return null;
  if (options.warehouseId && visit.warehouseId !== options.warehouseId) return null;
  const { lateExit: _lateExit, ...rest } = visit;
  return rest;
}

/**
 * Records the real exit on a visit already closed without a scan. The method and note stay, so
 * a missed check-out keeps its flag (managers were already told); the time becomes the scan's.
 */
export async function recordLateExit(
  em: EntityManager,
  visitId: string,
  exit: { by: string; checkOutEventId: string },
): Promise<void> {
  await em.query(
    `UPDATE "access_events"
        SET "checked_out_at" = clock_timestamp(), "checked_out_by" = $2, "check_out_event_id" = $3
      WHERE "id" = $1`,
    [visitId, exit.by, exit.checkOutEventId],
  );
}

export const AUTO_CLOSE_NOTES = {
  closingTime: 'Still inside at closing time',
  otherWarehouse: 'Checked in at another warehouse',
} as const;
