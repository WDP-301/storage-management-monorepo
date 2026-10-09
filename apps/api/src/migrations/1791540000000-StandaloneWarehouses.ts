import type { MigrationInterface, QueryRunner } from 'typeorm';

/** System-wide deposit level, read from the jsonb setting. */
const SETTING_DEPOSIT_MONTHS = `(SELECT ("value" #>> '{}')::numeric FROM "system_settings" WHERE "key" = 'deposit.default_months')`;

const SETTING_DESCRIPTION_BEFORE =
  'System-wide deposit level used when a unit type has no value of its own (unit_types.default_deposit_months).';
const SETTING_DESCRIPTION_AFTER =
  'System-wide deposit level used when a warehouse has no value of its own (storage_units.deposit_months).';

/**
 * A facility is a branch owning many warehouses; each warehouse (storage unit) carries its own
 * address, size, price and deposit. Unit types, zones and floor-map positions no longer exist.
 */
export class StandaloneWarehouses1791540000000 implements MigrationInterface {
  name = 'StandaloneWarehouses1791540000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const [{ duplicated }] = await queryRunner.query(
      `SELECT count(*)::int AS duplicated FROM (
         SELECT "code" FROM "storage_units" WHERE "deleted_at" IS NULL
          GROUP BY "code" HAVING count(*) > 1) t`,
    );
    if (duplicated > 0) {
      throw new Error(
        `${duplicated} warehouse codes are used by several units; codes must be unique. ` +
          'Reset the demo data first: pnpm --filter @storage/api db:reset-demo --yes ' +
          '(add --allow-remote=<database> for a non-local database)',
      );
    }

    // Price, dimensions and deposit move from the unit type onto the unit itself.
    await queryRunner.query(
      `ALTER TABLE "storage_units"
         ADD COLUMN "monthly_price" numeric(14,2),
         ADD COLUMN "width_m" numeric(7,2),
         ADD COLUMN "length_m" numeric(7,2),
         ADD COLUMN "height_m" numeric(7,2),
         ADD COLUMN "deposit_months" smallint`,
    );
    await queryRunner.query(
      `UPDATE "storage_units" su
          SET "monthly_price" = ut."monthly_price", "width_m" = ut."width_m",
              "length_m" = ut."length_m", "height_m" = ut."height_m",
              "deposit_months" = CASE
                WHEN ut."default_deposit_months" IS DISTINCT FROM ${SETTING_DEPOSIT_MONTHS}
                 AND ROUND(ut."default_deposit_months") BETWEEN 1 AND 12
                THEN ROUND(ut."default_deposit_months")::smallint END
         FROM "unit_types" ut
        WHERE su."unit_type_id" = ut."id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "storage_units"
         ALTER COLUMN "monthly_price" SET NOT NULL,
         ALTER COLUMN "width_m" SET NOT NULL,
         ALTER COLUMN "length_m" SET NOT NULL,
         ADD CONSTRAINT "CK_storage_units_monthly_price" CHECK ("monthly_price" >= 0),
         ADD CONSTRAINT "CK_storage_units_dimensions"
           CHECK ("width_m" > 0 AND "length_m" > 0 AND ("height_m" IS NULL OR "height_m" > 0)),
         ADD CONSTRAINT "CK_storage_units_deposit_months" CHECK ("deposit_months" BETWEEN 1 AND 12)`,
    );

    // Each warehouse owns its name, address and coordinates, copied from its current facility.
    await queryRunner.query(
      `ALTER TABLE "storage_units"
         ADD COLUMN "name" varchar(150), ADD COLUMN "address_line" varchar(255),
         ADD COLUMN "ward_code" varchar(20), ADD COLUMN "province_code" varchar(20),
         ADD COLUMN "latitude" numeric(9,6), ADD COLUMN "longitude" numeric(9,6)`,
    );
    await queryRunner.query(
      `UPDATE "storage_units" su
          SET "name" = f."name", "address_line" = f."address_line", "ward_code" = f."ward_code",
              "province_code" = f."province_code", "latitude" = f."latitude", "longitude" = f."longitude"
         FROM "facilities" f
        WHERE su."facility_id" = f."id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "storage_units"
         ALTER COLUMN "name" SET NOT NULL, ALTER COLUMN "address_line" SET NOT NULL,
         ALTER COLUMN "latitude" SET NOT NULL, ALTER COLUMN "longitude" SET NOT NULL,
         ADD CONSTRAINT "FK_storage_units_ward" FOREIGN KEY ("ward_code")
           REFERENCES "wards"("code") ON DELETE SET NULL ON UPDATE CASCADE,
         ADD CONSTRAINT "FK_storage_units_province" FOREIGN KEY ("province_code")
           REFERENCES "provinces"("code") ON DELETE SET NULL ON UPDATE CASCADE`,
    );

    // Area and volume are derived from the dimensions so they can never disagree with them.
    await queryRunner.query(
      `ALTER TABLE "storage_units"
         DROP COLUMN "area_m2",
         DROP COLUMN "zone",
         DROP COLUMN "pos_x",
         DROP COLUMN "pos_y",
         DROP COLUMN "unit_type_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "storage_units"
         ADD COLUMN "area_m2" numeric(12,2) GENERATED ALWAYS AS (round("width_m" * "length_m", 2)) STORED,
         ADD COLUMN "volume_m3" numeric(14,2)
           GENERATED ALWAYS AS (round("width_m" * "length_m" * "height_m", 2)) STORED`,
    );

    // Codes stay globally unique among live warehouses; facility lookups keep a plain index.
    await queryRunner.query(`ALTER TABLE "storage_units" DROP CONSTRAINT "UQ_units_facility_code"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_storage_units_code" ON "storage_units" ("code") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_storage_units_facility" ON "storage_units" ("facility_id")`,
    );

    // The facility keeps identity, region and status; location lives on its warehouses.
    await queryRunner.query(`ALTER TABLE "facilities" DROP CONSTRAINT "fk_facilities_ward_code"`);
    await queryRunner.query(
      `ALTER TABLE "facilities"
         DROP COLUMN "address_line", DROP COLUMN "ward_code",
         DROP COLUMN "latitude", DROP COLUMN "longitude"`,
    );

    await queryRunner.query(`ALTER TABLE "waitlist_entries" DROP COLUMN "unit_type_id"`);
    await queryRunner.query(`DROP TABLE "unit_types"`);

    await queryRunner.query(
      `UPDATE "system_settings" SET "description" = $1 WHERE "key" = 'deposit.default_months'`,
      [SETTING_DESCRIPTION_AFTER],
    );
  }

  /** Each unit gets a unit type of its own carrying its price and dimensions back. */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "system_settings" SET "description" = $1 WHERE "key" = 'deposit.default_months'`,
      [SETTING_DESCRIPTION_BEFORE],
    );
    await queryRunner.query(
      `CREATE TABLE "unit_types" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "code" varchar(50) NOT NULL UNIQUE, "name" varchar(100) NOT NULL,
        "width_m" numeric(7,2) NOT NULL CHECK ("width_m" > 0), "length_m" numeric(7,2) NOT NULL CHECK ("length_m" > 0),
        "height_m" numeric(7,2) CHECK ("height_m" IS NULL OR "height_m" > 0), "monthly_price" numeric(14,2) NOT NULL CHECK ("monthly_price" >= 0),
        "default_deposit_months" numeric(4,2) NOT NULL DEFAULT 1 CHECK ("default_deposit_months" >= 0),
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "waitlist_entries" ADD COLUMN "unit_type_id" uuid,
         ADD CONSTRAINT "FK_wait_type" FOREIGN KEY ("unit_type_id") REFERENCES "unit_types"("id") ON DELETE SET NULL`,
    );

    // Facilities take the address of their first live warehouse (placeholder when they have none).
    await queryRunner.query(
      `ALTER TABLE "facilities"
         ADD COLUMN "address_line" varchar(255), ADD COLUMN "ward_code" varchar(20),
         ADD COLUMN "latitude" numeric(9,6), ADD COLUMN "longitude" numeric(9,6)`,
    );
    await queryRunner.query(
      `UPDATE "facilities" f
          SET "address_line" = u."address_line", "ward_code" = u."ward_code",
              "latitude" = u."latitude", "longitude" = u."longitude"
         FROM (SELECT DISTINCT ON ("facility_id") * FROM "storage_units"
                ORDER BY "facility_id", "deleted_at" NULLS FIRST, "created_at") u
        WHERE u."facility_id" = f."id"`,
    );
    await queryRunner.query(
      `UPDATE "facilities"
          SET "address_line" = COALESCE("address_line", ''),
              "latitude" = COALESCE("latitude", 0), "longitude" = COALESCE("longitude", 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "facilities"
         ALTER COLUMN "address_line" SET NOT NULL, ALTER COLUMN "latitude" SET NOT NULL,
         ALTER COLUMN "longitude" SET NOT NULL,
         ADD CONSTRAINT "fk_facilities_ward_code" FOREIGN KEY ("ward_code")
           REFERENCES "wards"("code") ON DELETE SET NULL ON UPDATE CASCADE`,
    );

    await queryRunner.query(`DROP INDEX "IDX_storage_units_facility"`);
    await queryRunner.query(`DROP INDEX "UQ_storage_units_code"`);
    await queryRunner.query(
      `ALTER TABLE "storage_units" ADD CONSTRAINT "UQ_units_facility_code" UNIQUE ("facility_id", "code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "storage_units"
         DROP CONSTRAINT "FK_storage_units_ward", DROP CONSTRAINT "FK_storage_units_province",
         DROP COLUMN "name", DROP COLUMN "address_line", DROP COLUMN "ward_code",
         DROP COLUMN "province_code", DROP COLUMN "latitude", DROP COLUMN "longitude"`,
    );
    await queryRunner.query(
      `ALTER TABLE "storage_units"
         ADD COLUMN "unit_type_id" uuid, ADD COLUMN "zone" varchar(20),
         ADD COLUMN "pos_x" numeric(9,2), ADD COLUMN "pos_y" numeric(9,2),
         ADD COLUMN "area_m2_plain" numeric(9,2)`,
    );
    await queryRunner.query(
      `WITH created AS (
         INSERT INTO "unit_types" ("id", "code", "name", "width_m", "length_m", "height_m", "monthly_price", "default_deposit_months")
         SELECT su."id", 'U-' || su."id", su."code", su."width_m", su."length_m", su."height_m", su."monthly_price",
                COALESCE(su."deposit_months", ${SETTING_DEPOSIT_MONTHS}, 1)
           FROM "storage_units" su
         RETURNING "id")
       UPDATE "storage_units" su SET "unit_type_id" = created."id", "area_m2_plain" = su."area_m2"
         FROM created WHERE created."id" = su."id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "storage_units"
         DROP COLUMN "area_m2", DROP COLUMN "volume_m3",
         DROP COLUMN "monthly_price", DROP COLUMN "width_m", DROP COLUMN "length_m",
         DROP COLUMN "height_m", DROP COLUMN "deposit_months"`,
    );
    await queryRunner.query(
      `ALTER TABLE "storage_units" RENAME COLUMN "area_m2_plain" TO "area_m2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "storage_units"
         ALTER COLUMN "unit_type_id" SET NOT NULL, ALTER COLUMN "area_m2" SET NOT NULL,
         ADD CONSTRAINT "FK_units_type" FOREIGN KEY ("unit_type_id") REFERENCES "unit_types"("id"),
         ADD CONSTRAINT "storage_units_area_m2_check" CHECK ("area_m2" > 0),
         ADD CONSTRAINT "storage_units_check" CHECK (("pos_x" IS NULL) = ("pos_y" IS NULL))`,
    );
  }
}
