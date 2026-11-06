import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { AccessEventType } from '@storage/types';
import type { EntityManager } from 'typeorm';
import { COUNTER_SESSION_MINUTES } from './shelf-rules';

/** A scanned pass that still lets its scanner record receipts. */
export interface CounterSession {
  id: string;
  customerId: string;
  warehouseId: string;
  facilityId: string;
  startedAt: Date;
  expiresAt: Date;
}

type SessionReason = 'NOT_FOUND' | 'EXPIRED' | 'WRONG_CUSTOMER' | 'WRONG_WAREHOUSE';

const invalidSession = (reason: SessionReason) =>
  new DomainException(
    ErrorCode.COUNTER_SESSION_INVALID,
    'Phiên làm việc tại quầy không hợp lệ hoặc đã hết hạn — quét lại mã của khách',
    HttpStatus.CONFLICT,
    { reason },
  );

/**
 * Loads the counter session `sessionId` for the staff member who scanned it. Someone else's
 * session answers NOT_FOUND, so a session id says nothing about other counters. Expiry is judged
 * by the database clock, like the scan. When a contract is given it must belong to the session's
 * customer and sit in the session's warehouse.
 */
export async function assertLiveSession(
  em: EntityManager,
  actor: Pick<AuthUser, 'id'>,
  sessionId: string,
  contract?: { customerId: string; warehouse: { id: string } },
): Promise<CounterSession> {
  const [row]: (CounterSession & { live: boolean })[] = await em.query(
    `SELECT "id", "customer_id" AS "customerId", "warehouse_id" AS "warehouseId",
            "facility_id" AS "facilityId", "used_at" AS "startedAt",
            "used_at" + make_interval(mins => $3) AS "expiresAt",
            ("used_at" + make_interval(mins => $3) > clock_timestamp()) AS "live"
       FROM "access_events"
      WHERE "id" = $1 AND "verified_by" = $2 AND "event_type" = $4 AND "used_at" IS NOT NULL`,
    [sessionId, actor.id, COUNTER_SESSION_MINUTES, AccessEventType.COUNTER_SCAN],
  );
  if (!row) throw invalidSession('NOT_FOUND');
  if (!row.live) throw invalidSession('EXPIRED');
  if (contract) {
    if (contract.customerId !== row.customerId) throw invalidSession('WRONG_CUSTOMER');
    if (contract.warehouse.id !== row.warehouseId) throw invalidSession('WRONG_WAREHOUSE');
  }
  const { live: _live, ...session } = row;
  return session;
}
