import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DropInspectionStatus1791373230980 implements MigrationInterface {
  name = 'DropInspectionStatus1791373230980';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "inspections" DROP COLUMN "status"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inspections" ADD COLUMN "status" character varying(20) NOT NULL DEFAULT 'PENDING'`,
    );
  }
}
