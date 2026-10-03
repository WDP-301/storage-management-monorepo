import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `system_settings` key-value table used for admin-configurable
 * business rules (booking hold time, rental term limits, idempotency TTL, ...).
 *
 * Seed values are NOT inserted here — `SettingsService` upserts every key
 * defined in `settings.registry.ts` on application bootstrap, so the registry
 * in code stays the single source of truth for defaults.
 */
export class AddSystemSettings1790913439432 implements MigrationInterface {
  name = 'AddSystemSettings1790913439432';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "system_settings" (
        "key"         varchar(100) PRIMARY KEY,
        "value"       jsonb        NOT NULL,
        "value_type"  varchar(20)  NOT NULL
                      CHECK ("value_type" IN ('int','float','string','boolean','duration_minutes','int_list')),
        "group"       varchar(50)  NOT NULL,
        "description" text,
        "updated_by"  uuid,
        "created_at"  timestamptz  NOT NULL DEFAULT now(),
        "updated_at"  timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "FK_settings_updater" FOREIGN KEY ("updated_by") REFERENCES "app_users"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "system_settings"`);
  }
}
