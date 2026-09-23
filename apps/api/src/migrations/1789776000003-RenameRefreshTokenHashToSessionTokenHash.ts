import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameRefreshTokenHashToSessionTokenHash1789776000003 implements MigrationInterface {
  name = 'RenameRefreshTokenHashToSessionTokenHash1789776000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sessions" RENAME COLUMN "refresh_token_hash" TO "session_token_hash"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sessions" RENAME COLUMN "session_token_hash" TO "refresh_token_hash"`,
    );
  }
}
