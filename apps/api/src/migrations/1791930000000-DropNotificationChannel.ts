import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DropNotificationChannel1791930000000 implements MigrationInterface {
  name = 'DropNotificationChannel1791930000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "channel"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD COLUMN "channel" varchar(15) NOT NULL DEFAULT 'IN_APP' CHECK ("channel" IN ('IN_APP','EMAIL','SMS'))`,
    );
    await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "channel" DROP DEFAULT`);
  }
}
