import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInspectionHandoverFields1791091717851 implements MigrationInterface {
  name = 'AddInspectionHandoverFields1791091717851';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "inspections"
      ADD COLUMN "damages" jsonb NOT NULL DEFAULT '[]',
      ADD COLUMN "finalized_at" timestamptz`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "inspections"
      DROP COLUMN "damages",
      DROP COLUMN "finalized_at"`);
  }
}
