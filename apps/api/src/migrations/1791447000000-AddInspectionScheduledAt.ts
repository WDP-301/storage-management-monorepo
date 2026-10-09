import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInspectionScheduledAt1791447000000 implements MigrationInterface {
  name = 'AddInspectionScheduledAt1791447000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "inspections" ADD COLUMN "scheduled_at" TIMESTAMPTZ`);
    // Handover appointments default to the contract start date.
    await queryRunner.query(
      `UPDATE "inspections" i SET "scheduled_at" = c."effective_at"
         FROM "contracts" c
        WHERE c."id" = i."contract_id" AND i."type" = 'PRE_HANDOVER'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "inspections" DROP COLUMN "scheduled_at"`);
  }
}
