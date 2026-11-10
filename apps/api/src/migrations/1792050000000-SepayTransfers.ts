import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `sepay_transfers` is the audit log of inbound bank transfers: every webhook is persisted
 * before matching, and the outcome column is the reconciliation queue — money that arrived but
 * matched nothing (or hit an error) stays listed until a person resolves it.
 */
export class SepayTransfers1792050000000 implements MigrationInterface {
  name = 'SepayTransfers1792050000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sepay_transfers" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        "sepay_id" varchar(40) NOT NULL,
        "amount" numeric(14,2) NOT NULL,
        "content" text, "reference_code" varchar(100), "gateway" varchar(60),
        "transaction_date" timestamptz,
        "outcome" varchar(25) NOT NULL DEFAULT 'RECEIVED'
          CHECK ("outcome" IN ('RECEIVED','IGNORED','DEPOSIT_CONFIRMED','DEPOSIT_PARTIAL','INVOICE_PAID','INVOICE_PARTIAL','UNMATCHED','AMBIGUOUS','LATE','NEEDS_REVIEW','RESOLVED')),
        "booking_id" uuid, "invoice_id" uuid,
        "resolved_by" uuid, "resolved_at" timestamptz, "resolution_note" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_sepay_transfers_sepay_id" UNIQUE ("sepay_id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sepay_transfers_outcome" ON "sepay_transfers" ("outcome")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "sepay_transfers"`);
  }
}
