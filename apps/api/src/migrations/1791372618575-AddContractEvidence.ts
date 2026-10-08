import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContractEvidence1791372618575 implements MigrationInterface {
  name = 'AddContractEvidence1791372618575';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "contracts" ADD COLUMN "evidence" text`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN "evidence"`);
  }
}
