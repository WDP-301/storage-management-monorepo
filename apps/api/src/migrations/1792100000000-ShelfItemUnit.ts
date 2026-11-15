import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The unit a shelf item is counted in (kiện, thùng, bao, cái), on the item and snapshotted on
 * each receipt line and drop-off request line. Rows from before this change were counted without
 * one and become PACKAGE. The defaults stay so the instance still serving during a deploy, which
 * does not send a unit, keeps writing valid rows.
 */
export class ShelfItemUnit1792100000000 implements MigrationInterface {
  name = 'ShelfItemUnit1792100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const check = `IN ('PACKAGE','BOX','BAG','PIECE')`;
    await queryRunner.query(
      `ALTER TABLE "shelf_items" ADD COLUMN "unit" varchar(10) NOT NULL DEFAULT 'PACKAGE'
         CONSTRAINT "CK_shelf_items_unit" CHECK ("unit" ${check})`,
    );
    await queryRunner.query(
      `ALTER TABLE "shelf_receipt_lines" ADD COLUMN "unit" varchar(10) NOT NULL DEFAULT 'PACKAGE'
         CONSTRAINT "CK_shelf_receipt_lines_unit" CHECK ("unit" ${check})`,
    );
    // Drop-off request lines are jsonb: give each line its item's unit, or PACKAGE for a new name.
    await queryRunner.query(`
      UPDATE "drop_off_requests" r
         SET "lines" = (
           SELECT jsonb_agg(
                    e.line || jsonb_build_object('unit', COALESCE(
                      (SELECT i."unit" FROM "shelf_items" i WHERE i."id" = (e.line->>'itemId')::uuid),
                      'PACKAGE'))
                    ORDER BY e.ord)
             FROM jsonb_array_elements(r."lines") WITH ORDINALITY AS e(line, ord))
       WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(r."lines") l WHERE NOT l ? 'unit')`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "drop_off_requests" r
         SET "lines" = (
           SELECT jsonb_agg(e.line - 'unit' ORDER BY e.ord)
             FROM jsonb_array_elements(r."lines") WITH ORDINALITY AS e(line, ord))`);
    await queryRunner.query(`ALTER TABLE "shelf_receipt_lines" DROP COLUMN "unit"`);
    await queryRunner.query(`ALTER TABLE "shelf_items" DROP COLUMN "unit"`);
  }
}
