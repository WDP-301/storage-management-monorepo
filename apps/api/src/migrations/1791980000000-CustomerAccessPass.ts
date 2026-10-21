import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Check-in passes belong to the customer instead of one shelf contract: one rotating QR opens
 * every warehouse where they rent a shelf. Staff pick the warehouse before scanning, so an entry
 * records the customer and warehouse; contract and shelf stay only on entries made before this.
 * Unused passes are short-lived and carry the old meaning, so they are dropped.
 */
export class CustomerAccessPass1791980000000 implements MigrationInterface {
  name = 'CustomerAccessPass1791980000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "access_events" WHERE "used_at" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "access_events"
         ADD COLUMN "customer_id" uuid,
         ADD COLUMN "warehouse_id" uuid`,
    );
    await queryRunner.query(
      `UPDATE "access_events" e
          SET "customer_id" = c."customer_id", "warehouse_id" = u."parent_id"
         FROM "contracts" c, "storage_units" u
        WHERE c."id" = e."contract_id" AND u."id" = e."storage_unit_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_events"
         ALTER COLUMN "customer_id" SET NOT NULL,
         ALTER COLUMN "contract_id" DROP NOT NULL,
         ALTER COLUMN "storage_unit_id" DROP NOT NULL,
         ALTER COLUMN "facility_id" DROP NOT NULL,
         ADD CONSTRAINT "FK_access_events_customer" FOREIGN KEY ("customer_id") REFERENCES "app_users"("id") ON DELETE CASCADE,
         ADD CONSTRAINT "FK_access_events_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "storage_units"("id"),
         ADD CONSTRAINT "CK_access_events_used_place" CHECK ("used_at" IS NULL OR ("warehouse_id" IS NOT NULL AND "facility_id" IS NOT NULL))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_access_events_customer" ON "access_events" ("customer_id")`,
    );
    await queryRunner.query(
      `UPDATE "system_settings"
          SET "description" = 'How long a check-in QR code stays valid before the app rotates it. Each code works once, at any warehouse where the customer rents a shelf.'
        WHERE "key" = 'access.check_in_qr_ttl_minutes'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "system_settings"
          SET "description" = 'How long a shelf check-in QR code stays valid after the customer generates it. Each code works once.'
        WHERE "key" = 'access.check_in_qr_ttl_minutes'`,
    );
    // Customer-level rows have no contract or shelf to fall back to.
    await queryRunner.query(
      `DELETE FROM "access_events" WHERE "contract_id" IS NULL OR "storage_unit_id" IS NULL`,
    );
    await queryRunner.query(`DROP INDEX "IDX_access_events_customer"`);
    await queryRunner.query(
      `ALTER TABLE "access_events"
         DROP CONSTRAINT "CK_access_events_used_place",
         DROP CONSTRAINT "FK_access_events_warehouse",
         DROP CONSTRAINT "FK_access_events_customer",
         DROP COLUMN "warehouse_id",
         DROP COLUMN "customer_id",
         ALTER COLUMN "contract_id" SET NOT NULL,
         ALTER COLUMN "storage_unit_id" SET NOT NULL,
         ALTER COLUMN "facility_id" SET NOT NULL`,
    );
  }
}
