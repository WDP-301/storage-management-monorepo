import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A shelf warehouse is a building rented per shelf; each shelf is a storage unit pointing at it
 * through `parent_id`. Existing rows become SELF_STORAGE. The building itself is never rented, so
 * the database refuses a hold/booking/rental status on it instead of trusting every code path.
 * That the parent really is a SHELF_WAREHOUSE spans two rows, so the application enforces it.
 */
export class ShelfWarehouses1791900000000 implements MigrationInterface {
  name = 'ShelfWarehouses1791900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "storage_units"
         ADD COLUMN "kind" varchar(20) NOT NULL DEFAULT 'SELF_STORAGE',
         ADD COLUMN "parent_id" uuid,
         ADD CONSTRAINT "FK_storage_units_parent" FOREIGN KEY ("parent_id")
           REFERENCES "storage_units"("id") ON DELETE RESTRICT,
         ADD CONSTRAINT "CK_storage_units_kind"
           CHECK ("kind" IN ('SELF_STORAGE', 'SHELF_WAREHOUSE', 'SHELF')),
         ADD CONSTRAINT "CK_storage_units_parent" CHECK (("kind" = 'SHELF') = ("parent_id" IS NOT NULL)),
         ADD CONSTRAINT "CK_storage_units_shelf_warehouse_status"
           CHECK ("kind" <> 'SHELF_WAREHOUSE' OR "status" IN ('AVAILABLE', 'MAINTENANCE', 'INACTIVE'))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_storage_units_parent" ON "storage_units" ("parent_id") WHERE "parent_id" IS NOT NULL`,
    );
  }

  /**
   * Refuses to run while shelf rows exist, soft-deleted ones included: contracts reference them
   * and must not be orphaned, so they have to be hard-deleted (or converted) by hand first.
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    const [{ shelfRows }] = await queryRunner.query(
      `SELECT count(*)::int AS "shelfRows" FROM "storage_units" WHERE "kind" <> 'SELF_STORAGE'`,
    );
    if (shelfRows > 0) {
      throw new Error(
        `${shelfRows} shelf warehouse/shelf rows exist (soft-deleted included); hard-delete them or ` +
          `convert them to SELF_STORAGE first, then revert.`,
      );
    }
    await queryRunner.query(`DROP INDEX "IDX_storage_units_parent"`);
    await queryRunner.query(
      `ALTER TABLE "storage_units"
         DROP CONSTRAINT "CK_storage_units_shelf_warehouse_status",
         DROP CONSTRAINT "CK_storage_units_parent",
         DROP CONSTRAINT "CK_storage_units_kind",
         DROP CONSTRAINT "FK_storage_units_parent",
         DROP COLUMN "parent_id",
         DROP COLUMN "kind"`,
    );
  }
}
