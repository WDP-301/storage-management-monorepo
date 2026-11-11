import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drop-off requests: a customer tells the branch ahead, in the app, what they will bring to their
 * shelf and when. Staff confirm they are ready; the drop-off receipt at the counter completes it,
 * like a pick-up request. Additive: the instance still serving during a deploy ignores the new
 * table and the new receipt column.
 */
export class ShelfDropOffRequests1792090000000 implements MigrationInterface {
  name = 'ShelfDropOffRequests1792090000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "drop_off_requests" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "contract_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "requested_for" timestamptz NOT NULL,
        "note" varchar(500),
        "lines" jsonb NOT NULL CHECK (jsonb_typeof("lines") = 'array' AND jsonb_array_length("lines") > 0),
        "status" varchar(12) NOT NULL DEFAULT 'PENDING'
          CONSTRAINT "CK_drop_off_requests_status" CHECK ("status" IN ('PENDING','CONFIRMED','COMPLETED','CANCELLED')),
        "confirmed_at" timestamptz,
        "confirmed_by" uuid,
        "cancelled_at" timestamptz,
        "cancelled_by" uuid,
        "completed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_drop_off_requests_contract" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_drop_off_requests_customer" FOREIGN KEY ("customer_id") REFERENCES "app_users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_drop_off_requests_confirmed_by" FOREIGN KEY ("confirmed_by") REFERENCES "app_users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_drop_off_requests_cancelled_by" FOREIGN KEY ("cancelled_by") REFERENCES "app_users"("id") ON DELETE SET NULL,
        CONSTRAINT "CK_drop_off_requests_confirmed_at" CHECK ("status" <> 'CONFIRMED' OR "confirmed_at" IS NOT NULL),
        CONSTRAINT "CK_drop_off_requests_cancelled_at" CHECK ("status" <> 'CANCELLED' OR "cancelled_at" IS NOT NULL),
        CONSTRAINT "CK_drop_off_requests_completed_at" CHECK ("status" <> 'COMPLETED' OR "completed_at" IS NOT NULL)
      )`);
    // A NULL cancelled_by on a CANCELLED row means the system cancelled it (return finalize, unit change).
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_drop_off_requests_open_contract" ON "drop_off_requests" ("contract_id")
        WHERE "status" IN ('PENDING','CONFIRMED')`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_drop_off_requests_contract_created" ON "drop_off_requests" ("contract_id", "created_at" DESC)`,
    );

    await queryRunner.query(`ALTER TABLE "shelf_receipts" ADD COLUMN "drop_off_request_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "shelf_receipts"
         ADD CONSTRAINT "FK_shelf_receipts_drop_off_request" FOREIGN KEY ("drop_off_request_id")
           REFERENCES "drop_off_requests"("id") ON DELETE RESTRICT,
         ADD CONSTRAINT "CK_shelf_receipts_drop_off_request_type"
           CHECK ("drop_off_request_id" IS NULL OR "type" = 'DROP_OFF')`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_shelf_receipts_drop_off_request" ON "shelf_receipts" ("drop_off_request_id")
        WHERE "drop_off_request_id" IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_shelf_receipts_drop_off_request"`);
    await queryRunner.query(
      `ALTER TABLE "shelf_receipts"
         DROP CONSTRAINT "CK_shelf_receipts_drop_off_request_type",
         DROP CONSTRAINT "FK_shelf_receipts_drop_off_request",
         DROP COLUMN "drop_off_request_id"`,
    );
    await queryRunner.query(`DROP TABLE "drop_off_requests"`);
  }
}
