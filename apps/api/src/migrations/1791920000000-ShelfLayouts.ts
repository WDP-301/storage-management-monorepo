import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One optional floor plan per shelf warehouse, stored as a whole document: the editor saves the
 * entire drawing at once, so a single `version` guards all of it against lost updates. Placements
 * reference shelves by id inside the jsonb (no FK), so the application validates them on save.
 * That the warehouse really is a SHELF_WAREHOUSE spans two rows, so the application enforces it.
 */
export class ShelfLayouts1791920000000 implements MigrationInterface {
  name = 'ShelfLayouts1791920000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "shelf_layouts" (
         "warehouse_id" uuid NOT NULL,
         "rows" smallint NOT NULL,
         "cols" smallint NOT NULL,
         "elements" jsonb NOT NULL DEFAULT '[]',
         "placements" jsonb NOT NULL DEFAULT '[]',
         "version" integer NOT NULL DEFAULT 1,
         "updated_by" uuid,
         "created_at" timestamp with time zone NOT NULL DEFAULT now(),
         "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
         CONSTRAINT "PK_shelf_layouts" PRIMARY KEY ("warehouse_id"),
         CONSTRAINT "CK_shelf_layouts_rows" CHECK ("rows" BETWEEN 1 AND 100),
         CONSTRAINT "CK_shelf_layouts_cols" CHECK ("cols" BETWEEN 1 AND 100),
         CONSTRAINT "FK_shelf_layouts_warehouse" FOREIGN KEY ("warehouse_id")
           REFERENCES "storage_units"("id") ON DELETE CASCADE,
         CONSTRAINT "FK_shelf_layouts_updated_by" FOREIGN KEY ("updated_by")
           REFERENCES "app_users"("id") ON DELETE SET NULL
       )`,
    );
  }

  /** Refuses to run while layouts exist: dropping the table would discard drawn floor plans. */
  async down(queryRunner: QueryRunner): Promise<void> {
    const [{ layouts }] = await queryRunner.query(
      `SELECT count(*)::int AS "layouts" FROM "shelf_layouts"`,
    );
    if (layouts > 0) {
      throw new Error(`${layouts} shelf layouts exist; delete the layouts first, then revert.`);
    }
    await queryRunner.query(`DROP TABLE "shelf_layouts"`);
  }
}
