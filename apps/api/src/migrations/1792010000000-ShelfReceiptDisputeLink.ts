import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A customer can report a wrong receipt as a service ticket. The ticket points at the receipt so
 * staff see which one is disputed. Voiding or deleting a receipt never removes the ticket: the link
 * is just cleared. The partial index serves the "open ticket for this receipt" lookups.
 */
export class ShelfReceiptDisputeLink1792010000000 implements MigrationInterface {
  name = 'ShelfReceiptDisputeLink1792010000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "service_tickets" ADD COLUMN "shelf_receipt_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "service_tickets" ADD CONSTRAINT "FK_service_tickets_shelf_receipt"
         FOREIGN KEY ("shelf_receipt_id") REFERENCES "shelf_receipts"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_service_tickets_shelf_receipt" ON "service_tickets" ("shelf_receipt_id")
         WHERE "shelf_receipt_id" IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_service_tickets_shelf_receipt"`);
    await queryRunner.query(
      `ALTER TABLE "service_tickets" DROP CONSTRAINT "FK_service_tickets_shelf_receipt"`,
    );
    await queryRunner.query(`ALTER TABLE "service_tickets" DROP COLUMN "shelf_receipt_id"`);
  }
}
