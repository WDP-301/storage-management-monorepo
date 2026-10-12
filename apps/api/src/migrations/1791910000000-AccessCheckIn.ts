import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Shelf check-in passes live in `access_events` (a row is a pass; `used_at` set = the entry).
 * Each pass snapshots the shelf and facility it was issued for, because a change request can
 * later move the contract to another unit and the audit trail must keep the original place.
 * Also indexes the invoice lookup that runs on every pass and scan, and seeds the QR lifetime.
 */
export class AccessCheckIn1791910000000 implements MigrationInterface {
  name = 'AccessCheckIn1791910000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Nothing wrote this table before, so there is no unit to backfill; refuse rather than guess.
    const [{ rows }] = await queryRunner.query(
      `SELECT count(*)::int AS "rows" FROM "access_events"`,
    );
    if (rows > 0) {
      throw new Error(
        `access_events has ${rows} rows; the unit/facility snapshot cannot be backfilled.`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "access_events"
         ADD COLUMN "storage_unit_id" uuid NOT NULL,
         ADD COLUMN "facility_id" uuid NOT NULL,
         ADD CONSTRAINT "FK_access_events_storage_unit" FOREIGN KEY ("storage_unit_id") REFERENCES "storage_units"("id"),
         ADD CONSTRAINT "FK_access_events_facility" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_access_events_contract" ON "access_events" ("contract_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_access_events_facility_used" ON "access_events" ("facility_id", "used_at" DESC) WHERE "used_at" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invoices_customer_open" ON "invoices" ("customer_id", "due_at") WHERE "status" IN ('ISSUED', 'PARTIALLY_PAID')`,
    );
    await queryRunner.query(`
      INSERT INTO "system_settings"
        ("key", "value", "value_type", "group", "description", "label", "default_value", "min", "max")
      VALUES
        ('access.check_in_qr_ttl_minutes', '10', 'int', 'access', 'How long a shelf check-in QR code stays valid after the customer generates it. Each code works once.', 'Check-in QR lifetime (minutes)', '10', 1, 60)
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "system_settings" WHERE "key" = 'access.check_in_qr_ttl_minutes'`,
    );
    await queryRunner.query(`DROP INDEX "IDX_invoices_customer_open"`);
    await queryRunner.query(`DROP INDEX "IDX_access_events_facility_used"`);
    await queryRunner.query(`DROP INDEX "IDX_access_events_contract"`);
    await queryRunner.query(
      `ALTER TABLE "access_events"
         DROP CONSTRAINT "FK_access_events_facility",
         DROP CONSTRAINT "FK_access_events_storage_unit",
         DROP COLUMN "facility_id",
         DROP COLUMN "storage_unit_id"`,
    );
  }
}
