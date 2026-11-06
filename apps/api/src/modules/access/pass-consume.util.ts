import { COUNTER_SESSION_MINUTES } from '@modules/shelf-storage/shelf-rules';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { AccessEventType } from '@storage/types';
import type { EntityManager } from 'typeorm';

export interface PassRow {
  id: string;
  customerId: string;
  usedAt: Date | null;
  verifiedBy: string | null;
  eventType: AccessEventType;
  warehouseId: string | null;
  expired: boolean;
  /** Used less than a counter session ago. */
  live: boolean;
}

export const invalidPass = (reason: string, details: Record<string, unknown> = {}) =>
  new DomainException(
    ErrorCode.ACCESS_PASS_INVALID,
    'This QR code cannot be used',
    HttpStatus.CONFLICT,
    { reason, ...details },
  );

/**
 * Reads the pass by token hash and keeps its row locked for the rest of the transaction, so two
 * scanners of one code are serialised and the second sees `used_at`. Expiry and liveness are
 * evaluated by the database, the same clock the pass was issued with. They read clock_timestamp(),
 * not now(): the transaction may have started before waiting on this lock.
 */
export async function lockPass(em: EntityManager, tokenHash: string): Promise<PassRow> {
  const [pass]: PassRow[] = await em.query(
    `SELECT "id", "customer_id" AS "customerId", "used_at" AS "usedAt",
            "verified_by" AS "verifiedBy", "event_type" AS "eventType",
            "warehouse_id" AS "warehouseId",
            ("expires_at" <= clock_timestamp()) AS "expired",
            ("used_at" IS NOT NULL
              AND "used_at" > clock_timestamp() - make_interval(mins => $2)) AS "live"
       FROM "access_events"
      WHERE "qr_token_hash" = $1
      FOR UPDATE`,
    [tokenHash, COUNTER_SESSION_MINUTES],
  );
  if (!pass) throw invalidPass('NOT_FOUND');
  return pass;
}

/** Refuses a pass that was already scanned or has expired, unless the caller reopens it. */
export function assertPassUnused(pass: PassRow, actorId: string): void {
  if (pass.usedAt) {
    throw invalidPass('USED', { usedAt: pass.usedAt, verifiedByMe: pass.verifiedBy === actorId });
  }
  if (pass.expired) throw invalidPass('EXPIRED');
}

/** Stamps the pass as consumed at this counter; the row then is the counter session. */
export async function markPassUsedAtCounter(
  em: EntityManager,
  passId: string,
  actorId: string,
  warehouse: { id: string; facilityId: string },
): Promise<Date> {
  // The postgres driver returns UPDATE … RETURNING as [rows, affectedCount], unlike SELECT/INSERT.
  const [[{ usedAt }]]: [{ usedAt: Date }[], number] = await em.query(
    `UPDATE "access_events"
        SET "used_at" = clock_timestamp(), "verified_by" = $2,
            "warehouse_id" = $3, "facility_id" = $4, "event_type" = $5
      WHERE "id" = $1 RETURNING "used_at" AS "usedAt"`,
    [passId, actorId, warehouse.id, warehouse.facilityId, AccessEventType.COUNTER_SCAN],
  );
  return usedAt;
}
