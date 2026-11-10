import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Unit-change scheduling: `move_at` is the agreed move day (customer-proposed, manager-confirmed)
 * and `topup_invoice_id` points at the DEPOSIT_TOPUP invoice issued on approval, so a later
 * cancel can void it when unpaid.
 */
export class UnitChangeMoveFields1792080000000 implements MigrationInterface {
  name = 'UnitChangeMoveFields1792080000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "unit_change_requests"
         ADD COLUMN "move_at" timestamptz,
         ADD COLUMN "topup_invoice_id" uuid`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "unit_change_requests"
         DROP COLUMN "topup_invoice_id",
         DROP COLUMN "move_at"`,
    );
  }
}
