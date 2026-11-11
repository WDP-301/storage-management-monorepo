import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `type` to `shift_templates`: OFFICE (administrative hours) or WAREHOUSE (storage duty).
 * Schema only — the `seed:shifts` script replaces the rows themselves. Existing rows are
 * backfilled to 'OFFICE' so the column can go NOT NULL before the reseed.
 */
export class ShiftTemplateType1792090000000 implements MigrationInterface {
  name = 'ShiftTemplateType1792090000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shift_templates" ADD COLUMN "type" varchar(20)`);
    await queryRunner.query(`UPDATE "shift_templates" SET "type" = 'OFFICE' WHERE "type" IS NULL`);
    await queryRunner.query(`ALTER TABLE "shift_templates" ALTER COLUMN "type" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "shift_templates" ADD CONSTRAINT "CK_shift_templates_type" CHECK ("type" IN ('OFFICE', 'WAREHOUSE'))`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shift_templates" DROP CONSTRAINT "CK_shift_templates_type"`,
    );
    await queryRunner.query(`ALTER TABLE "shift_templates" DROP COLUMN "type"`);
  }
}
