import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "One open change request per contract" was check-then-insert in the service — two concurrent
 * POSTs could both open one. The partial unique index makes the rule real: the second insert
 * fails instead of racing through.
 */
export class OpenChangeRequestUnique1792060000000 implements MigrationInterface {
  name = 'OpenChangeRequestUnique1792060000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Anything left open beyond the newest request cannot be told apart; close the stale ones
    // first so the index can be built.
    await queryRunner.query(
      `UPDATE "unit_change_requests" SET "status" = 'CANCELLED'
        WHERE "id" IN (
          SELECT "id" FROM (
            SELECT "id", row_number() OVER (PARTITION BY "contract_id" ORDER BY "created_at" DESC) AS rn
              FROM "unit_change_requests"
             WHERE "status" IN ('REQUESTED','PROPOSED','APPROVED','TRANSITIONING')) t
          WHERE t.rn > 1)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_open_change_request" ON "unit_change_requests" ("contract_id")
         WHERE "status" IN ('REQUESTED','PROPOSED','APPROVED','TRANSITIONING')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_open_change_request"`);
  }
}
