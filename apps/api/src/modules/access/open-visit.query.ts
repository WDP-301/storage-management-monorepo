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

export const AUTO_CLOSE_NOTES = {
  closingTime: 'Still inside at closing time',
  otherWarehouse: 'Checked in at another warehouse',
} as const;
