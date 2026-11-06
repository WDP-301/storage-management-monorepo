import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Staff-managed shelf storage. Customers no longer walk into shelf warehouses: staff scan the
 * customer's pass at the counter (stored as a COUNTER_SCAN access event) and record what goes
 * onto or comes off the shelf as itemized receipts. Stock belongs to the contract, not to a
 * stored shelf, because a unit change rewrites the contract's shelf; receipts snapshot the shelf.
 * Everything is additive: the instance still serving during a deploy ignores the new tables and
 * the new event type, and the old closing-hour setting row stays.
 */
export class ShelfStaffStorage1792000000000 implements MigrationInterface {
  name = 'ShelfStaffStorage1792000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // The first schema declared the event_type check inline, so its name is not known: find it
    // by definition.
    await queryRunner.query(`
      DO $$
      DECLARE c record;
      BEGIN
        FOR c IN
          SELECT conname FROM pg_constraint
           WHERE conrelid = '"access_events"'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) LIKE '%event_type%'
        LOOP
          EXECUTE format('ALTER TABLE "access_events" DROP CONSTRAINT %I', c.conname);
        END LOOP;
      END $$`);
    await queryRunner.query(
      `ALTER TABLE "access_events" ADD CONSTRAINT "CK_access_events_event_type"
         CHECK ("event_type" IN ('CHECK_IN','CHECK_OUT','COUNTER_SCAN'))`,
    );

    await queryRunner.query(`
      CREATE TABLE "shelf_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "contract_id" uuid NOT NULL,
        "name" varchar(120) NOT NULL CHECK (btrim("name") <> ''),
        "quantity" int NOT NULL DEFAULT 0 CHECK ("quantity" >= 0),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_shelf_items_contract" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT
      )`);
    // Backstop for the app's own case-insensitive match over the locked rows.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_shelf_items_contract_name" ON "shelf_items" ("contract_id", lower("name"))`,
    );

    await queryRunner.query(`
      CREATE TABLE "pickup_requests" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "contract_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "requested_for" timestamptz NOT NULL,
        "note" varchar(500),
        "lines" jsonb NOT NULL CHECK (jsonb_typeof("lines") = 'array' AND jsonb_array_length("lines") > 0),
        "status" varchar(12) NOT NULL DEFAULT 'PENDING'
          CONSTRAINT "CK_pickup_requests_status" CHECK ("status" IN ('PENDING','READY','COMPLETED','CANCELLED')),
        "ready_at" timestamptz,
        "ready_by" uuid,
        "cancelled_at" timestamptz,
        "cancelled_by" uuid,
        "completed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_pickup_requests_contract" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_pickup_requests_customer" FOREIGN KEY ("customer_id") REFERENCES "app_users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_pickup_requests_ready_by" FOREIGN KEY ("ready_by") REFERENCES "app_users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_pickup_requests_cancelled_by" FOREIGN KEY ("cancelled_by") REFERENCES "app_users"("id") ON DELETE SET NULL,
        CONSTRAINT "CK_pickup_requests_ready_at" CHECK ("status" <> 'READY' OR "ready_at" IS NOT NULL),
        CONSTRAINT "CK_pickup_requests_cancelled_at" CHECK ("status" <> 'CANCELLED' OR "cancelled_at" IS NOT NULL),
        CONSTRAINT "CK_pickup_requests_completed_at" CHECK ("status" <> 'COMPLETED' OR "completed_at" IS NOT NULL)
      )`);
    // A NULL cancelled_by on a CANCELLED row means the system cancelled it (return finalize).
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_pickup_requests_open_contract" ON "pickup_requests" ("contract_id")
        WHERE "status" IN ('PENDING','READY')`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pickup_requests_contract_created" ON "pickup_requests" ("contract_id", "created_at" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE "shelf_receipts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "code" varchar(30) NOT NULL,
        "type" varchar(10) NOT NULL CONSTRAINT "CK_shelf_receipts_type" CHECK ("type" IN ('DROP_OFF','PICK_UP')),
        "status" varchar(10) NOT NULL DEFAULT 'ACTIVE' CONSTRAINT "CK_shelf_receipts_status" CHECK ("status" IN ('ACTIVE','VOIDED')),
        "contract_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "storage_unit_id" uuid NOT NULL,
        "warehouse_id" uuid NOT NULL,
        "facility_id" uuid NOT NULL,
        "session_id" uuid,
        "client_request_id" uuid NOT NULL,
        "performed_by" uuid,
        "note" varchar(1000),
        "photos" jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof("photos") = 'array'),
        "pickup_request_id" uuid,
        "voided_at" timestamptz,
        "voided_by" uuid,
        "void_reason" varchar(500),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_shelf_receipts_contract" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_shelf_receipts_customer" FOREIGN KEY ("customer_id") REFERENCES "app_users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_shelf_receipts_unit" FOREIGN KEY ("storage_unit_id") REFERENCES "storage_units"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_shelf_receipts_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "storage_units"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_shelf_receipts_facility" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT,
        -- Used passes are never deleted; NULL means a scan-less recovery.
        CONSTRAINT "FK_shelf_receipts_session" FOREIGN KEY ("session_id") REFERENCES "access_events"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_shelf_receipts_performed_by" FOREIGN KEY ("performed_by") REFERENCES "app_users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_shelf_receipts_request" FOREIGN KEY ("pickup_request_id") REFERENCES "pickup_requests"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_shelf_receipts_voided_by" FOREIGN KEY ("voided_by") REFERENCES "app_users"("id") ON DELETE SET NULL,
        CONSTRAINT "CK_shelf_receipts_void_pair" CHECK (("status" = 'VOIDED') = ("voided_at" IS NOT NULL)),
        CONSTRAINT "CK_shelf_receipts_void_reason" CHECK ("status" <> 'VOIDED' OR "void_reason" IS NOT NULL),
        CONSTRAINT "CK_shelf_receipts_request_type" CHECK ("pickup_request_id" IS NULL OR "type" = 'PICK_UP'),
        CONSTRAINT "CK_shelf_receipts_drop_off_photo" CHECK ("type" <> 'DROP_OFF' OR jsonb_array_length("photos") >= 1),
        CONSTRAINT "CK_shelf_receipts_recovery" CHECK (
          "session_id" IS NOT NULL
          OR ("type" = 'PICK_UP' AND "note" IS NOT NULL AND jsonb_array_length("photos") >= 1)
        )
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_shelf_receipts_code" ON "shelf_receipts" ("code")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_shelf_receipts_client_request" ON "shelf_receipts" ("client_request_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_shelf_receipts_contract_created" ON "shelf_receipts" ("contract_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_shelf_receipts_warehouse_created" ON "shelf_receipts" ("warehouse_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_shelf_receipts_pickup_request" ON "shelf_receipts" ("pickup_request_id")
        WHERE "pickup_request_id" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "shelf_receipt_lines" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "receipt_id" uuid NOT NULL,
        "item_id" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "quantity" int NOT NULL CHECK ("quantity" > 0),
        CONSTRAINT "FK_shelf_receipt_lines_receipt" FOREIGN KEY ("receipt_id") REFERENCES "shelf_receipts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_shelf_receipt_lines_item" FOREIGN KEY ("item_id") REFERENCES "shelf_items"("id") ON DELETE RESTRICT
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_shelf_receipt_lines_item" ON "shelf_receipt_lines" ("receipt_id", "item_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_shelf_receipt_lines_item" ON "shelf_receipt_lines" ("item_id")`,
    );

    await queryRunner.query(
      `UPDATE "system_settings"
          SET "description" = 'How long a customer''s drop-off / pick-up QR code stays valid before the app rotates it. Each code works once, at any warehouse where the customer rents a shelf.'
        WHERE "key" = 'access.check_in_qr_ttl_minutes'`,
    );
    // The row stays: the instance still serving during a deploy reads it in its closing-time job.
    await queryRunner.query(
      `UPDATE "system_settings"
          SET "label" = 'Warehouse closing hour (no longer used)',
              "description" = 'No longer used: customers no longer enter shelf warehouses.'
        WHERE "key" = 'access.closing_hour'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "system_settings"
          SET "description" = 'How long a check-in QR code stays valid before the app rotates it. Each code works once, at any warehouse where the customer rents a shelf.'
        WHERE "key" = 'access.check_in_qr_ttl_minutes'`,
    );
    await queryRunner.query(
      `UPDATE "system_settings"
          SET "label" = 'Warehouse closing hour',
              "description" = 'Hour (Vietnam time, 0-23) at which shelf warehouses close. Visits still open then are closed automatically as a missed check-out and the facility managers are told.'
        WHERE "key" = 'access.closing_hour'`,
    );
    await queryRunner.query(`DROP TABLE "shelf_receipt_lines"`);
    await queryRunner.query(`DROP TABLE "shelf_receipts"`);
    await queryRunner.query(`DROP TABLE "pickup_requests"`);
    await queryRunner.query(`DROP TABLE "shelf_items"`);
    // Counter scans mean nothing to the old schema.
    await queryRunner.query(`DELETE FROM "access_events" WHERE "event_type" = 'COUNTER_SCAN'`);
    await queryRunner.query(
      `ALTER TABLE "access_events" DROP CONSTRAINT "CK_access_events_event_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_events" ADD CONSTRAINT "access_events_event_type_check"
         CHECK ("event_type" IN ('CHECK_IN','CHECK_OUT'))`,
    );
  }
}
