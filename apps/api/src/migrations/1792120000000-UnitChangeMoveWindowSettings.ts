import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The days a customer may book a unit-change move on, counted in Vietnam days from today:
 * `contract.unit_change_min_lead_days` leaves the branch time to approve (and the customer to
 * pay a top-up) before the move; `contract.unit_change_max_days_ahead` caps how far ahead the
 * destination unit can be held. The time of day itself comes from the OFFICE shift templates.
 */
export class UnitChangeMoveWindowSettings1792120000000 implements MigrationInterface {
  name = 'UnitChangeMoveWindowSettings1792120000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "system_settings"
        ("key", "value", "value_type", "group", "description", "label", "default_value", "min", "max")
      VALUES
        ('contract.unit_change_min_lead_days', '1', 'int', 'contract', 'Minimum days between today and the move day a customer picks for a unit change (0 allows today, at a future time inside office hours).', 'Unit change minimum notice (days)', '1', 0, 30),
        ('contract.unit_change_max_days_ahead', '90', 'int', 'contract', 'Furthest day ahead a unit-change move can be booked or confirmed.', 'Unit change booking horizon (days)', '90', 1, 365)
      ON CONFLICT ("key") DO NOTHING`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "system_settings" WHERE "key" IN ('contract.unit_change_min_lead_days', 'contract.unit_change_max_days_ahead')`,
    );
  }
}
