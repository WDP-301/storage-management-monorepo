import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 1789776000008: Refactor Booking, Contracts, and Invoices Schema
 *
 * Changes:
 * 1. Alter `booking_items`:
 *    - Add `requested_start_at` (timestamptz) and `rental_months` (int).
 *    - Backfill from `bookings` before dropping those columns.
 * 2. Alter `bookings`:
 *    - Drop `requested_start_at`, `rental_months`, and `preferred_facility_id`.
 * 3. Alter `contracts`:
 *    - Add `booking_item_id` (FK to booking_items), `kind`, `months`, `monthly_price_snapshot`, `rent_total`.
 *    - Drop legacy `booking_id` reference.
 * 4. Update referencing tables from `contract_unit_id` to `contract_id`:
 *    - `deposits`, `unit_change_requests`, `access_events`, `inspections`, `handover_assets`.
 * 5. Alter `invoice_items`:
 *    - Remove `rental_period_id`.
 * 6. Alter `invoices`:
 *    - Merge columns from `rental_periods`: `period_no`, `kind`, `start_at`, `end_at`, `months`, `monthly_price_snapshot`.
 * 7. Drop legacy intermediate tables:
 *    - Drop `rental_periods` and `contract_units`.
 */
export class RefactorBookingContractsInvoicesSchema1789776000008 implements MigrationInterface {
  name = 'RefactorBookingContractsInvoicesSchema1789776000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Alter booking_items: add schedule columns & backfill from bookings ──
    await queryRunner.query(`
      ALTER TABLE "booking_items"
        ADD COLUMN "requested_start_at" timestamptz,
        ADD COLUMN "rental_months" integer;
    `);

    // Backfill existing booking_items from bookings
    await queryRunner.query(`
      UPDATE "booking_items" bi
      SET "requested_start_at" = COALESCE(b."requested_start_at", now()),
          "rental_months" = COALESCE(b."rental_months", 1)
      FROM "bookings" b
      WHERE bi."booking_id" = b."id";
    `);

    // Set defaults/fallback for any orphaned rows and apply NOT NULL + CHECK
    await queryRunner.query(`
      UPDATE "booking_items"
      SET "requested_start_at" = now() WHERE "requested_start_at" IS NULL;
      UPDATE "booking_items"
      SET "rental_months" = 1 WHERE "rental_months" IS NULL;

      ALTER TABLE "booking_items"
        ALTER COLUMN "requested_start_at" SET NOT NULL,
        ALTER COLUMN "rental_months" SET NOT NULL,
        ADD CONSTRAINT "CHK_booking_items_rental_months" CHECK ("rental_months" > 0 AND "rental_months" <= 60);
    `);

    // ── 2. Alter bookings: drop per-unit schedule & preferred facility ──────────
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP COLUMN IF EXISTS "requested_start_at",
        DROP COLUMN IF EXISTS "rental_months",
        DROP COLUMN IF EXISTS "preferred_facility_id";
    `);

    // ── 3. Alter contracts: link to booking_items + add kind and pricing snapshots
    await queryRunner.query(`
      ALTER TABLE "contracts"
        DROP CONSTRAINT IF EXISTS "FK_contract_booking",
        DROP COLUMN IF EXISTS "booking_id",
        ADD COLUMN "booking_item_id" uuid,
        ADD COLUMN "kind" varchar(20) NOT NULL DEFAULT 'INITIAL' CHECK ("kind" IN ('INITIAL', 'RENEWAL')),
        ADD COLUMN "months" integer NOT NULL DEFAULT 1 CHECK ("months" > 0),
        ADD COLUMN "monthly_price_snapshot" numeric(14,2) NOT NULL DEFAULT 0 CHECK ("monthly_price_snapshot" >= 0),
        ADD COLUMN "rent_total" numeric(14,2) NOT NULL DEFAULT 0 CHECK ("rent_total" >= 0);
    `);

    await queryRunner.query(`
      ALTER TABLE "contracts"
        ADD CONSTRAINT "FK_contract_booking_item"
        FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE CASCADE;
    `);

    // ── 4. Repoint dependent tables from contract_units to contracts ───────────
    // deposits
    await queryRunner.query(`
      ALTER TABLE "deposits" DROP CONSTRAINT IF EXISTS "FK_deposit_contract_unit";
      ALTER TABLE "deposits" RENAME COLUMN "contract_unit_id" TO "contract_id";
      ALTER TABLE "deposits" ADD CONSTRAINT "FK_deposit_contract"
        FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE;
    `);

    // unit_change_requests
    await queryRunner.query(`
      ALTER TABLE "unit_change_requests" DROP CONSTRAINT IF EXISTS "FK_change_contract_unit";
      ALTER TABLE "unit_change_requests" RENAME COLUMN "contract_unit_id" TO "contract_id";
      ALTER TABLE "unit_change_requests" ADD CONSTRAINT "FK_change_contract"
        FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE;
    `);

    // access_events
    await queryRunner.query(`
      ALTER TABLE "access_events" DROP CONSTRAINT IF EXISTS "FK_access_contract_unit";
      ALTER TABLE "access_events" RENAME COLUMN "contract_unit_id" TO "contract_id";
      ALTER TABLE "access_events" ADD CONSTRAINT "FK_access_contract"
        FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE;
    `);

    // inspections
    await queryRunner.query(`
      ALTER TABLE "inspections" DROP CONSTRAINT IF EXISTS "FK_inspection_contract_unit";
      ALTER TABLE "inspections" RENAME COLUMN "contract_unit_id" TO "contract_id";
      ALTER TABLE "inspections" ADD CONSTRAINT "FK_inspection_contract"
        FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE;
    `);

    // handover_assets
    await queryRunner.query(`
      ALTER TABLE "handover_assets" DROP CONSTRAINT IF EXISTS "FK_asset_contract_unit";
      ALTER TABLE "handover_assets" RENAME COLUMN "contract_unit_id" TO "contract_id";
      ALTER TABLE "handover_assets" ADD CONSTRAINT "FK_asset_contract"
        FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE;
    `);

    // ── 5. Alter invoice_items: remove rental_period_id ────────────────────────
    await queryRunner.query(`
      ALTER TABLE "invoice_items" DROP CONSTRAINT IF EXISTS "FK_invoice_item_period";
      ALTER TABLE "invoice_items" DROP COLUMN IF EXISTS "rental_period_id";
    `);

    // ── 6. Alter invoices: merge fields from rental_periods ───────────────────
    await queryRunner.query(`
      ALTER TABLE "invoices"
        ADD COLUMN "period_no" integer NOT NULL DEFAULT 1 CHECK ("period_no" > 0),
        ADD COLUMN "kind" varchar(20) NOT NULL DEFAULT 'INITIAL' CHECK ("kind" IN ('INITIAL', 'RENEWAL')),
        ADD COLUMN "start_at" timestamptz,
        ADD COLUMN "end_at" timestamptz,
        ADD COLUMN "months" integer NOT NULL DEFAULT 1 CHECK ("months" > 0),
        ADD COLUMN "monthly_price_snapshot" numeric(14,2) NOT NULL DEFAULT 0 CHECK ("monthly_price_snapshot" >= 0);
    `);

    // ── 7. Drop obsolete intermediate tables ──────────────────────────────────
    await queryRunner.query(`DROP TABLE IF EXISTS "rental_periods" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "contract_units" CASCADE;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate contract_units
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contract_units" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        "contract_id" uuid NOT NULL,
        "storage_unit_id" uuid NOT NULL,
        "start_at" timestamptz NOT NULL,
        "end_at" timestamptz NOT NULL,
        "monthly_price_snapshot" numeric(14,2) NOT NULL CHECK ("monthly_price_snapshot" >= 0),
        "deposit_snapshot" numeric(14,2) NOT NULL CHECK ("deposit_snapshot" >= 0),
        "status" varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('PENDING','ACTIVE','TRANSITIONING','ENDED')),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_contract_units_contract" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_contract_units_unit" FOREIGN KEY ("storage_unit_id") REFERENCES "storage_units"("id"),
        CHECK ("end_at" > "start_at")
      );
    `);

    // Recreate rental_periods
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rental_periods" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        "contract_unit_id" uuid NOT NULL,
        "period_no" integer NOT NULL CHECK ("period_no" > 0),
        "kind" varchar(20) NOT NULL CHECK ("kind" IN ('INITIAL','RENEWAL')),
        "start_at" timestamptz NOT NULL,
        "end_at" timestamptz NOT NULL,
        "months" integer NOT NULL CHECK ("months" > 0),
        "monthly_price_snapshot" numeric(14,2) NOT NULL CHECK ("monthly_price_snapshot" >= 0),
        "rent_total" numeric(14,2) NOT NULL CHECK ("rent_total" >= 0),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_period_contract_unit" FOREIGN KEY ("contract_unit_id") REFERENCES "contract_units"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_period_no" UNIQUE ("contract_unit_id","period_no"),
        CHECK ("end_at" > "start_at")
      );
    `);

    // Revert invoices
    await queryRunner.query(`
      ALTER TABLE "invoices"
        DROP COLUMN IF EXISTS "period_no",
        DROP COLUMN IF EXISTS "kind",
        DROP COLUMN IF EXISTS "start_at",
        DROP COLUMN IF EXISTS "end_at",
        DROP COLUMN IF EXISTS "months",
        DROP COLUMN IF EXISTS "monthly_price_snapshot";
    `);

    // Revert invoice_items
    await queryRunner.query(`
      ALTER TABLE "invoice_items" ADD COLUMN "rental_period_id" uuid;
      ALTER TABLE "invoice_items" ADD CONSTRAINT "FK_invoice_item_period"
        FOREIGN KEY ("rental_period_id") REFERENCES "rental_periods"("id") ON DELETE SET NULL;
    `);

    // Revert foreign keys on dependent tables
    await queryRunner.query(`
      ALTER TABLE "deposits" DROP CONSTRAINT IF EXISTS "FK_deposit_contract";
      ALTER TABLE "deposits" RENAME COLUMN "contract_id" TO "contract_unit_id";

      ALTER TABLE "unit_change_requests" DROP CONSTRAINT IF EXISTS "FK_change_contract";
      ALTER TABLE "unit_change_requests" RENAME COLUMN "contract_id" TO "contract_unit_id";

      ALTER TABLE "access_events" DROP CONSTRAINT IF EXISTS "FK_access_contract";
      ALTER TABLE "access_events" RENAME COLUMN "contract_id" TO "contract_unit_id";

      ALTER TABLE "inspections" DROP CONSTRAINT IF EXISTS "FK_inspection_contract";
      ALTER TABLE "inspections" RENAME COLUMN "contract_id" TO "contract_unit_id";

      ALTER TABLE "handover_assets" DROP CONSTRAINT IF EXISTS "FK_asset_contract";
      ALTER TABLE "handover_assets" RENAME COLUMN "contract_id" TO "contract_unit_id";
    `);

    // Revert contracts
    await queryRunner.query(`
      ALTER TABLE "contracts"
        DROP CONSTRAINT IF EXISTS "FK_contract_booking_item",
        DROP COLUMN IF EXISTS "booking_item_id",
        DROP COLUMN IF EXISTS "kind",
        DROP COLUMN IF EXISTS "months",
        DROP COLUMN IF EXISTS "monthly_price_snapshot",
        DROP COLUMN IF EXISTS "rent_total",
        ADD COLUMN "booking_id" uuid;
      ALTER TABLE "contracts" ADD CONSTRAINT "FK_contract_booking"
        FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL;
    `);

    // Revert bookings
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ADD COLUMN "requested_start_at" timestamptz,
        ADD COLUMN "rental_months" integer,
        ADD COLUMN "preferred_facility_id" uuid;
    `);

    // Revert booking_items
    await queryRunner.query(`
      ALTER TABLE "booking_items"
        DROP CONSTRAINT IF EXISTS "CHK_booking_items_rental_months",
        DROP COLUMN IF EXISTS "requested_start_at",
        DROP COLUMN IF EXISTS "rental_months";
    `);
  }
}
