import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One live invoice per contract period: two taps on "create QR" (or two staff at once) must
 * not bill the first month twice. A VOID invoice frees its period for a replacement.
 */
export class InvoiceContractPeriodUnique1791720000000 implements MigrationInterface {
  name = 'InvoiceContractPeriodUnique1791720000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_invoices_contract_period" ON "invoices" ("contract_id", "period_no")
       WHERE "contract_id" IS NOT NULL AND "status" <> 'VOID'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_invoices_contract_period"`);
  }
}
