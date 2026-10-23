import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Check-out: a used CHECK_IN row is a visit, open until it gets a check-out. The exit scan
 * consumes its own pass row (stored as CHECK_OUT) and links it from the visit. A partial unique
 * index keeps at most one open visit per customer. Entries recorded before check-out existed
 * have no exit time, so they are closed as AUTO rather than shown as still inside.
 */
export class AccessCheckOut1791990000000 implements MigrationInterface {
  name = 'AccessCheckOut1791990000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "access_events"
         ADD COLUMN "checked_out_at" timestamptz,
         ADD COLUMN "checked_out_by" uuid,
         ADD COLUMN "check_out_method" varchar(10),
         ADD COLUMN "check_out_note" varchar(255),
         ADD COLUMN "check_out_event_id" uuid,
         ADD CONSTRAINT "FK_access_events_checked_out_by" FOREIGN KEY ("checked_out_by") REFERENCES "app_users"("id") ON DELETE SET NULL,
         ADD CONSTRAINT "FK_access_events_check_out_event" FOREIGN KEY ("check_out_event_id") REFERENCES "access_events"("id") ON DELETE SET NULL,
         ADD CONSTRAINT "CK_access_events_check_out_method" CHECK ("check_out_method" IN ('SCAN','MANUAL','AUTO')),
         ADD CONSTRAINT "CK_access_events_check_out_pair" CHECK (("check_out_method" IS NULL) = ("checked_out_at" IS NULL))`,
    );
    await queryRunner.query(
      `UPDATE "access_events"
          SET "checked_out_at" = now(), "check_out_method" = 'AUTO',
              "check_out_note" = 'Recorded before check-out existed'
        WHERE "event_type" = 'CHECK_IN' AND "used_at" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_access_events_customer_inside" ON "access_events" ("customer_id")
        WHERE "event_type" = 'CHECK_IN' AND "used_at" IS NOT NULL AND "checked_out_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_access_events_warehouse_inside" ON "access_events" ("warehouse_id", "used_at")
        WHERE "event_type" = 'CHECK_IN' AND "used_at" IS NOT NULL AND "checked_out_at" IS NULL`,
    );
    await queryRunner.query(`
      INSERT INTO "system_settings"
        ("key", "value", "value_type", "group", "description", "label", "default_value", "min", "max")
      VALUES
        ('access.closing_hour', '22', 'int', 'access', 'Hour (Vietnam time, 0-23) at which shelf warehouses close. Visits still open then are closed automatically as a missed check-out and the facility managers are told.', 'Warehouse closing hour', '22', 0, 23)
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "system_settings" WHERE "key" = 'access.closing_hour'`);
    await queryRunner.query(`DROP INDEX "IDX_access_events_warehouse_inside"`);
    await queryRunner.query(`DROP INDEX "IDX_access_events_customer_inside"`);
    // Exit scans have no meaning without the visit columns.
    await queryRunner.query(`DELETE FROM "access_events" WHERE "event_type" = 'CHECK_OUT'`);
    await queryRunner.query(
      `ALTER TABLE "access_events"
         DROP CONSTRAINT "CK_access_events_check_out_pair",
         DROP CONSTRAINT "CK_access_events_check_out_method",
         DROP CONSTRAINT "FK_access_events_check_out_event",
         DROP CONSTRAINT "FK_access_events_checked_out_by",
         DROP COLUMN "check_out_event_id",
         DROP COLUMN "check_out_note",
         DROP COLUMN "check_out_method",
         DROP COLUMN "checked_out_by",
         DROP COLUMN "checked_out_at"`,
    );
  }
}
