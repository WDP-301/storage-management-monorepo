import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A contract may hold several open drop-off requests (capped in the service under the contract
 * row lock), so the one-open-request unique index becomes a plain partial index that still serves
 * the per-contract open count.
 */
export class MultipleOpenDropOffRequests1792150000000 implements MigrationInterface {
  name = 'MultipleOpenDropOffRequests1792150000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_drop_off_requests_open_contract"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_drop_off_requests_open_contract" ON "drop_off_requests" ("contract_id")
        WHERE "status" IN ('PENDING','CONFIRMED')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_drop_off_requests_open_contract"`);
    // Keep only the earliest open request per contract so the unique index can be rebuilt;
    // a NULL cancelled_by marks the others as cancelled by the system.
    await queryRunner.query(
      `UPDATE "drop_off_requests" r
          SET "status" = 'CANCELLED', "cancelled_at" = now(), "updated_at" = now()
        WHERE r."status" IN ('PENDING','CONFIRMED')
          AND EXISTS (
            SELECT 1 FROM "drop_off_requests" o
             WHERE o."contract_id" = r."contract_id"
               AND o."status" IN ('PENDING','CONFIRMED')
               AND (o."requested_for", o."id") < (r."requested_for", r."id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_drop_off_requests_open_contract" ON "drop_off_requests" ("contract_id")
        WHERE "status" IN ('PENDING','CONFIRMED')`,
    );
  }
}
