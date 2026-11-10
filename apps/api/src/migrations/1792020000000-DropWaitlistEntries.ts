import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The waitlist feature was never implemented: nothing in the API, web or mobile app reads or
 * writes `waitlist_entries`. Dropping the table keeps the schema honest — a table the
 * application does not know about should not exist.
 */
export class DropWaitlistEntries1792020000000 implements MigrationInterface {
  name = 'DropWaitlistEntries1792020000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "waitlist_entries"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "waitlist_entries" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "customer_id" uuid NOT NULL, "booking_id" uuid, "facility_id" uuid NOT NULL,
        "quantity" integer NOT NULL DEFAULT 1 CHECK ("quantity" > 0), "min_price" numeric(14,2) CHECK ("min_price" >= 0), "max_price" numeric(14,2) CHECK ("max_price" >= 0),
        "nearby_required" boolean NOT NULL DEFAULT false, "status" varchar(20) NOT NULL DEFAULT 'WAITING' CHECK ("status" IN ('WAITING','OFFERED','ACCEPTED','EXPIRED','CANCELLED')),
        "offer_expires_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_wait_customer" FOREIGN KEY ("customer_id") REFERENCES "app_users"("id"), CONSTRAINT "FK_wait_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_wait_facility" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id"), CHECK ("max_price" IS NULL OR "min_price" IS NULL OR "max_price" >= "min_price")
      )`,
    );
  }
}
