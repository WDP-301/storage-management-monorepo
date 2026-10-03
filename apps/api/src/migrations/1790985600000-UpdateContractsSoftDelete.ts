import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateContractsSoftDelete1790985600000 implements MigrationInterface {
  name = 'UpdateContractsSoftDelete1790985600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "contracts"
      ADD COLUMN "delete_at" timestamptz,
      DROP COLUMN "rent_total"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "contracts"
      ADD COLUMN "rent_total" numeric(14,2) NOT NULL DEFAULT 0 CHECK ("rent_total" >= 0)`);
    // Reconstruct the removed derived value; original totals cannot be recovered exactly.
    await queryRunner.query(`UPDATE "contracts"
      SET "rent_total" = "monthly_price_snapshot" * "months"`);
    await queryRunner.query('ALTER TABLE "contracts" DROP COLUMN "delete_at"');
  }
}
