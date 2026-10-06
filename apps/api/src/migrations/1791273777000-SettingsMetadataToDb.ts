import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Moves setting metadata (label, description, bounds, default) into the
 * `system_settings` table itself — the DB becomes the single source of truth.
 * Existing `value`/`updated_by` are preserved: the upsert refreshes metadata
 * columns only, so admin-set values survive the migration.
 */
export class SettingsMetadataToDb1791273777000 implements MigrationInterface {
  name = 'SettingsMetadataToDb1791273777000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings"
        ADD COLUMN IF NOT EXISTS "label"         text,
        ADD COLUMN IF NOT EXISTS "default_value" jsonb,
        ADD COLUMN IF NOT EXISTS "min"           double precision,
        ADD COLUMN IF NOT EXISTS "max"           double precision
    `);

    await queryRunner.query(`
      INSERT INTO "system_settings"
        ("key", "value", "value_type", "group", "description", "label", "default_value", "min", "max")
      VALUES
        ('booking.hold_minutes', '15', 'int', 'booking', 'How long selected units stay HELD for a booking before the cron job automatically releases them.', 'Booking hold time (minutes)', '15', 1, 1440),
        ('booking.lead_days', '30', 'int', 'booking', 'The rental start date (requested_start_at) cannot be further in the future than this many days.', 'Max lead days', '30', 1, 365),
        ('booking.min_rental_months', '6', 'int', 'booking', 'Bookings with rentalMonths below this value are rejected.', 'Minimum rental term (months)', '6', 1, 60),
        ('booking.max_rental_months', '60', 'int', 'booking', 'Bookings with rentalMonths above this value are rejected. Cannot exceed 60 due to a DB CHECK constraint.', 'Maximum rental term (months)', '60', 1, 60),
        ('booking.default_rental_months', '6', 'int', 'booking', 'Default value for clients (UI) when the user does not explicitly pick a rental term.', 'Default rental term (months)', '6', 1, 60),
        ('booking.rental_months_options', '[6,12,18]', 'int_list', 'booking', 'List of terms offered to customers in the UI. Display-only suggestion, not a hard limit.', 'Suggested rental terms (months)', '[6,12,18]', 1, 60),
        ('booking.max_units_per_booking', '4', 'int', 'booking', 'Limits the number of storage units in one booking so a single customer cannot occupy too many units at once.', 'Max units per booking', '4', 1, 20),
        ('idempotency.ttl_hours', '24', 'int', 'idempotency', 'How long an idempotency key is kept to guard against duplicate retries before the cron job removes it.', 'Idempotency key TTL (hours)', '24', 1, 720),
        ('idempotency.stale_seconds', '60', 'int', 'idempotency', 'A key stuck in PROCESSING beyond this threshold (e.g. after a server crash) can be reclaimed by another request.', 'Stale PROCESSING key threshold (seconds)', '60', 10, 3600),
        ('deposit.default_months', '1', 'float', 'deposit', 'System-wide deposit level used when a unit type has no value of its own (unit_types.default_deposit_months).', 'Default deposit months', '1', 0, 12)
      ON CONFLICT ("key") DO UPDATE SET
        "value_type"    = EXCLUDED."value_type",
        "group"         = EXCLUDED."group",
        "description"   = EXCLUDED."description",
        "label"         = EXCLUDED."label",
        "default_value" = EXCLUDED."default_value",
        "min"           = EXCLUDED."min",
        "max"           = EXCLUDED."max"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings"
        DROP COLUMN IF EXISTS "label",
        DROP COLUMN IF EXISTS "default_value",
        DROP COLUMN IF EXISTS "min",
        DROP COLUMN IF EXISTS "max"
    `);
  }
}
