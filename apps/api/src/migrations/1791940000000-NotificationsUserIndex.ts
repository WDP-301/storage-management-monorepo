import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Every notification read is scoped to its owner (`user_id = <session user>`) and listed newest
 * first, so the inbox, unread count and mark-all-read all run on this index instead of a scan.
 */
export class NotificationsUserIndex1791940000000 implements MigrationInterface {
  name = 'NotificationsUserIndex1791940000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_created" ON "notifications" ("user_id", "created_at" DESC, "id" DESC)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_notifications_user_created"`);
  }
}
