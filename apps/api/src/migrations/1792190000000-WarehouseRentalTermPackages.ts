import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rental term packages become the rule rather than a suggestion: a customer books or renews only
 * for one of the listed terms. A warehouse may carry its own list (null follows the setting), so
 * the min/max term settings no longer decide anything and are removed.
 */
export class WarehouseRentalTermPackages1792190000000 implements MigrationInterface {
  name = 'WarehouseRentalTermPackages1792190000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Same 1–60 bound as booking_items.rental_months, so a package can always be booked.
    await queryRunner.query(
      `ALTER TABLE "storage_units"
         ADD COLUMN "rental_months_options" smallint[],
         ADD CONSTRAINT "CK_storage_units_rental_months_options" CHECK (
           "rental_months_options" IS NULL OR (
             cardinality("rental_months_options") > 0
             AND 1 <= ALL ("rental_months_options")
             AND 60 >= ALL ("rental_months_options")))`,
    );
    await queryRunner.query(
      `UPDATE "system_settings"
          SET "label" = 'Rental term packages (months)',
              "description" = 'Terms a customer can book or renew for. A warehouse with its own packages uses those instead.'
        WHERE "key" = 'booking.rental_months_options'`,
    );
    await queryRunner.query(
      `DELETE FROM "system_settings"
        WHERE "key" IN ('booking.min_rental_months', 'booking.max_rental_months')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "system_settings"
        ("key", "value", "value_type", "group", "description", "label", "default_value", "min", "max")
      VALUES
        ('booking.min_rental_months', '1', 'int', 'booking', 'Bookings with rentalMonths below this value are rejected.', 'Minimum rental term (months)', '6', 1, 60),
        ('booking.max_rental_months', '60', 'int', 'booking', 'Bookings with rentalMonths above this value are rejected. Cannot exceed 60 due to a DB CHECK constraint.', 'Maximum rental term (months)', '60', 1, 60)
      ON CONFLICT ("key") DO NOTHING`);
    await queryRunner.query(
      `UPDATE "system_settings"
          SET "label" = 'Suggested rental terms (months)',
              "description" = 'List of terms offered to customers in the UI. Display-only suggestion, not a hard limit.'
        WHERE "key" = 'booking.rental_months_options'`,
    );
    await queryRunner.query(
      `ALTER TABLE "storage_units"
         DROP CONSTRAINT "CK_storage_units_rental_months_options",
         DROP COLUMN "rental_months_options"`,
    );
  }
}
