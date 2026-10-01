import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `idempotency_keys` table used to make `POST /bookings` safe to retry.
 *
 * Design decisions:
 *   - Composite PK (key, user_id): keys are scoped per user — different users may
 *     independently generate the same UUID without conflict.
 *   - status: PROCESSING → DONE two-phase write so concurrent requests with the
 *     same key are serialised at the DB level via ON CONFLICT DO UPDATE + xmax trick.
 *   - request_hash (SHA-256 hex): detects key reuse with a different payload → 422.
 *   - response_body JSONB: caches the full response so retries don't need extra queries.
 *   - expires_at index: allows the cron job to clean up expired rows efficiently.
 */
export class AddIdempotencyKeys1789776000007 implements MigrationInterface {
  name = 'AddIdempotencyKeys1789776000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "idempotency_keys" (
        "key"             VARCHAR(100)  NOT NULL,
        "user_id"         UUID          NOT NULL,
        "status"          VARCHAR(20)   NOT NULL DEFAULT 'PROCESSING',
        "request_hash"    CHAR(64)      NOT NULL,
        "response_status" SMALLINT,
        "response_body"   JSONB,
        "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "expires_at"      TIMESTAMPTZ   NOT NULL,
        CONSTRAINT "PK_idempotency_keys" PRIMARY KEY ("key", "user_id"),
        CONSTRAINT "CHK_idempotency_keys_status"
          CHECK ("status" IN ('PROCESSING', 'DONE'))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_idempotency_keys_expires_at" ON "idempotency_keys" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_idempotency_keys_expires_at"`);
    await queryRunner.query(`DROP TABLE "idempotency_keys"`);
  }
}
