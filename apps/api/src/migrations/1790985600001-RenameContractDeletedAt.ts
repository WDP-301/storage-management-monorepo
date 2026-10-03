import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameContractDeletedAt1790985600001 implements MigrationInterface {
  name = 'RenameContractDeletedAt1790985600001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "contracts" RENAME COLUMN "delete_at" TO "deleted_at"');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "contracts" RENAME COLUMN "deleted_at" TO "delete_at"');
  }
}
