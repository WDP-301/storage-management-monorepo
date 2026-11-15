import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pick-up and drop-off requests are given to one staff member round robin, like handovers and
 * returns. Additive and nullable: requests made before stay unassigned, and the instance still
 * serving during a deploy keeps writing them unassigned.
 */
export class ShelfRequestAssignment1792140000000 implements MigrationInterface {
  name = 'ShelfRequestAssignment1792140000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['pickup_requests', 'drop_off_requests']) {
      await queryRunner.query(
        `ALTER TABLE "${table}"
           ADD COLUMN "assigned_to" uuid,
           ADD COLUMN "assigned_at" timestamptz,
           ADD CONSTRAINT "FK_${table}_assigned_to" FOREIGN KEY ("assigned_to")
             REFERENCES "app_users"("id") ON DELETE SET NULL`,
      );
      // The rotation reads the latest assignment of a facility.
      await queryRunner.query(
        `CREATE INDEX "IDX_${table}_assigned_at" ON "${table}" ("assigned_at" DESC)
          WHERE "assigned_to" IS NOT NULL`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['pickup_requests', 'drop_off_requests']) {
      await queryRunner.query(`DROP INDEX "IDX_${table}_assigned_at"`);
      await queryRunner.query(
        `ALTER TABLE "${table}"
           DROP CONSTRAINT "FK_${table}_assigned_to",
           DROP COLUMN "assigned_at",
           DROP COLUMN "assigned_to"`,
      );
    }
  }
}
