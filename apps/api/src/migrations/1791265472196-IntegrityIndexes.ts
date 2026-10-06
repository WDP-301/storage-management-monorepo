import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two integrity gaps closed at the database level so races cannot defeat them:
 *
 * - payments.provider_ref: webhook deduplication must survive concurrent deliveries;
 *   the service-level exists() check is only a fast path — this partial unique index
 *   is the real guard against double-recording the same SePay transaction.
 * - contracts(booking_item_id) kind='INITIAL': one initial contract per booking item.
 *   RENEWAL rows are exempt — a unit can be re-rented after the initial term ends.
 */
export class IntegrityIndexes1791265472196 implements MigrationInterface {
  name = 'IntegrityIndexes1791265472196';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_payments_provider_ref" ON "payments" ("provider_ref") WHERE "provider_ref" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_contract_initial_item" ON "contracts" ("booking_item_id") WHERE "kind" = 'INITIAL' AND "deleted_at" IS NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_payments_provider_ref"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_contract_initial_item"`);
  }
}
