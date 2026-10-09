import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInspectionRequestNote1791533000000 implements MigrationInterface {
  name = 'AddInspectionRequestNote1791533000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "inspections" ADD COLUMN "request_note" TEXT`);
    // Until now the customer's move-out note lived in condition_notes, where the inspector's
    // own notes overwrote it. Open return requests keep their note in the new column.
    await queryRunner.query(
      `UPDATE "inspections"
          SET "request_note" = "condition_notes", "condition_notes" = NULL
        WHERE "type" = 'RETURN' AND "finalized_at" IS NULL AND "condition_notes" IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "inspections" SET "condition_notes" = COALESCE("condition_notes", "request_note")
        WHERE "request_note" IS NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "inspections" DROP COLUMN "request_note"`);
  }
}
