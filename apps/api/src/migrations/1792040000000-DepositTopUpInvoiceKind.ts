import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Drops the single-column CHECKs on `table.column`, whatever name PostgreSQL gave them. */
async function dropColumnChecks(qr: QueryRunner, table: string, column: string): Promise<void> {
  const checks: { conname: string }[] = await qr.query(
    `SELECT con."conname" FROM "pg_constraint" con
       JOIN "pg_attribute" a ON a."attrelid" = con."conrelid" AND a."attnum" = ANY(con."conkey")
      WHERE con."conrelid" = $1::regclass AND con."contype" = 'c' AND a."attname" = $2
        AND array_length(con."conkey", 1) = 1`,
    [table, column],
  );
  for (const { conname } of checks) {
    await qr.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${conname}"`);
  }
}

/**
 * A completed unit change can raise the required deposit; the difference is billed on a
 * DEPOSIT_TOPUP invoice. Like SETTLEMENT it is outside the rental periods, so the
 * (contract_id, period_no) unique index does not apply — a contract may see several of them.
 */
export class DepositTopUpInvoiceKind1792040000000 implements MigrationInterface {
  name = 'DepositTopUpInvoiceKind1792040000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await dropColumnChecks(queryRunner, 'invoices', 'kind');
    await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "CK_invoices_kind"
      CHECK ("kind" IN ('INITIAL', 'RENEWAL', 'SETTLEMENT', 'DEPOSIT_TOPUP'))`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_invoices_contract_period"`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_invoices_contract_period" ON "invoices" ("contract_id", "period_no")
      WHERE "contract_id" IS NOT NULL AND "status" <> 'VOID' AND "kind" NOT IN ('SETTLEMENT', 'DEPOSIT_TOPUP')`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [{ n }] = (await queryRunner.query(
      `SELECT count(*)::int AS n FROM "invoices" WHERE "kind" = 'DEPOSIT_TOPUP'`,
    )) as Array<{ n: number }>;
    if (n > 0) {
      throw new Error(`DepositTopUpInvoiceKind cannot be reverted: ${n} top-up invoice(s) exist`);
    }
    await dropColumnChecks(queryRunner, 'invoices', 'kind');
    await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "CK_invoices_kind"
      CHECK ("kind" IN ('INITIAL', 'RENEWAL', 'SETTLEMENT'))`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_invoices_contract_period"`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_invoices_contract_period" ON "invoices" ("contract_id", "period_no")
      WHERE "contract_id" IS NOT NULL AND "status" <> 'VOID' AND "kind" <> 'SETTLEMENT'`);
  }
}
