import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `contract.no_show_after_days`: how many days past the contracted start (the booked handover
 * day) a DRAFT contract may sit before the facility manager is nudged that the customer never
 * collected the unit. Suggestion only — cancelling (and refunding) stays a human decision.
 */
export class NoShowAfterDaysSetting1792070000000 implements MigrationInterface {
  name = 'NoShowAfterDaysSetting1792070000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "system_settings"
        ("key", "value", "value_type", "group", "description", "label", "default_value", "min", "max")
      VALUES
        ('contract.no_show_after_days', '3', 'int', 'contract', 'Days past the contracted start date after which a still-DRAFT contract (handover never happened) is flagged to the facility manager as a no-show.', 'No-show threshold (days)', '3', 1, 30)
      ON CONFLICT ("key") DO NOTHING`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "system_settings" WHERE "key" = 'contract.no_show_after_days'`,
    );
  }
}
