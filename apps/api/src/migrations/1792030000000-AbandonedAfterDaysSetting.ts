import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `contract.abandoned_after_days`: how many days past the term end an ACTIVE contract may sit
 * without an open return request before the facility manager is nudged to open an abandoned-unit
 * recovery. Suggestion only — a person still decides; nothing is marked automatically.
 */
export class AbandonedAfterDaysSetting1792030000000 implements MigrationInterface {
  name = 'AbandonedAfterDaysSetting1792030000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "system_settings"
        ("key", "value", "value_type", "group", "description", "label", "default_value", "min", "max")
      VALUES
        ('contract.abandoned_after_days', '30', 'int', 'contract', 'Days past the end of an active contract term with no return request after which the facility manager is notified that the unit may have been abandoned.', 'Abandoned-unit threshold (days)', '30', 3, 365)
      ON CONFLICT ("key") DO NOTHING`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "system_settings" WHERE "key" = 'contract.abandoned_after_days'`,
    );
  }
}
