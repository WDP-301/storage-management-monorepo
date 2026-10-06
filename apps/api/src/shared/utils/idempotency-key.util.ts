import { IdempotencyKey } from '@entities/idempotency-key.entity';
import { HttpStatus, Logger } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { IdempotencyStatus } from '@storage/types';
import type { Repository } from 'typeorm';

const IDEMPOTENCY_TTL_HOURS = 24;
const STALE_PROCESSING_SECONDS = 60;

export interface ClaimIdempotencyOptions {
  ttlHours?: number;
  staleSeconds?: number;
}

const logger = new Logger('IdempotencyKey');

type IdemRow = {
  key: string;
  user_id: string;
  status: IdempotencyStatus;
  request_hash: string;
  response_status: number | null;
  response_body: Record<string, unknown> | null;
  created_at: string;
  expires_at: string;
  is_new_insert: boolean;
};

const keyConflict = () =>
  new DomainException(
    ErrorCode.IDEMPOTENCY_KEY_CONFLICT,
    'Request khác đang xử lý với cùng idempotency key, vui lòng thử lại sau',
    HttpStatus.CONFLICT,
  );

/**
 * Atomically claims an idempotency key: INSERT … ON CONFLICT reports whether this call
 * won the claim (`xmax = 0` on a fresh insert). A DONE row with the same payload returns
 * its cached response; a fresh PROCESSING row conflicts; a stale one (>60 s, crashed
 * instance) is reclaimed atomically. Returns the cached response body, or null when this
 * caller owns the claim and must do the work.
 */
export async function claimIdempotencyKey(
  repo: Repository<IdempotencyKey>,
  key: string,
  userId: string,
  requestHash: string,
  opts?: ClaimIdempotencyOptions,
): Promise<Record<string, unknown> | null> {
  const ttlHours = opts?.ttlHours ?? IDEMPOTENCY_TTL_HOURS;
  const staleSeconds = opts?.staleSeconds ?? STALE_PROCESSING_SECONDS;

  const [idem] = await repo.query<IdemRow[]>(
    `INSERT INTO idempotency_keys (key, user_id, status, request_hash, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(hours => $5))
     ON CONFLICT (key, user_id) DO UPDATE
       SET expires_at = idempotency_keys.expires_at
     RETURNING *, (xmax = 0) AS is_new_insert`,
    [key, userId, IdempotencyStatus.PROCESSING, requestHash, ttlHours],
  );

  if (idem.is_new_insert) {
    return null;
  }

  if (idem.request_hash !== requestHash) {
    throw new DomainException(
      ErrorCode.IDEMPOTENCY_PAYLOAD_MISMATCH,
      'Idempotency key đã được dùng với payload khác',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  if (idem.status === IdempotencyStatus.DONE) {
    return idem.response_body ?? {};
  }

  const isStale = Date.now() - new Date(idem.created_at).getTime() > staleSeconds * 1000;
  if (!isStale) {
    throw keyConflict();
  }

  logger.warn(
    `Idempotency key ${key} was stuck in PROCESSING for user ${userId}. Re-claiming stale key.`,
  );
  const reclaimed = await repo.query<IdemRow[]>(
    `UPDATE idempotency_keys
     SET created_at = now(),
         request_hash = $1,
         expires_at = now() + make_interval(hours => $2)
     WHERE key = $3
       AND user_id = $4
       AND status = $5
       AND created_at <= now() - make_interval(secs => $6)
     RETURNING *, true AS is_new_insert`,
    [requestHash, ttlHours, key, userId, IdempotencyStatus.PROCESSING, staleSeconds],
  );

  if (!reclaimed || reclaimed.length === 0) {
    throw keyConflict();
  }
  return null;
}

/** Releases a still-PROCESSING claim so a retry can proceed; never deletes a DONE row. */
export async function releaseIdempotencyKey(
  repo: Repository<IdempotencyKey>,
  key: string,
  userId: string,
): Promise<void> {
  await repo.delete({ key, userId, status: IdempotencyStatus.PROCESSING });
}
