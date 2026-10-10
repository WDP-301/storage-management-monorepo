import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Warehouse photos: a jsonb array of `{ fileKey, name, mimeType, size? }`, first is the cover. */
export class WarehouseImages1791710000000 implements MigrationInterface {
  name = 'WarehouseImages1791710000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "storage_units" ADD COLUMN "images" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "storage_units" DROP COLUMN "images"`);
  }
}
