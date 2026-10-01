import { IdempotencyStatus } from '@storage/types';
import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('idempotency_keys')
export class IdempotencyKey {
  /** UUID string sent by the client in the `Idempotency-Key` header. */
  @PrimaryColumn({ type: 'varchar', length: 100 })
  key: string;

  /** Scopes the key per user — different users may generate the same UUID independently. */
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  /** Two-phase status: PROCESSING while the booking transaction is running, DONE after commit. */
  @Column({ type: 'varchar', length: 20, default: IdempotencyStatus.PROCESSING })
  status: IdempotencyStatus;

  /** SHA-256 hex of the request body. Detects key reuse with a different payload → 422. */
  @Column({ type: 'char', length: 64, name: 'request_hash' })
  requestHash: string;

  /** HTTP status code of the cached response (set when status = DONE). */
  @Column({ type: 'smallint', nullable: true, name: 'response_status' })
  responseStatus?: number;

  /** Full response body cached as JSONB — returned directly on retry without extra queries. */
  @Column({ type: 'jsonb', nullable: true, name: 'response_body' })
  responseBody?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  /** Key expires after 24 h — cleaned up by the hold-expiry cron job. */
  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;
}
