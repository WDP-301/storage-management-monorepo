import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Contract renewals: a customer asks to extend an ACTIVE contract by some months at its current
 * price, a branch manager approves (the contract's `months` grows) or rejects. One PENDING request
 * per contract. Additive: the instance still serving during a deploy ignores the new table.
 */
export class ContractRenewals1792160000000 implements MigrationInterface {
  name = 'ContractRenewals1792160000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "contract_renewals" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "contract_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "months" int NOT NULL CONSTRAINT "CK_contract_renewals_months" CHECK ("months" > 0),
        "note" varchar(500),
        "status" varchar(12) NOT NULL DEFAULT 'PENDING'
          CONSTRAINT "CK_contract_renewals_status" CHECK ("status" IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
        "previous_months" int,
        "decision_note" varchar(500),
        "decided_by" uuid,
        "decided_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_contract_renewals_contract" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_contract_renewals_customer" FOREIGN KEY ("customer_id") REFERENCES "app_users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_contract_renewals_decided_by" FOREIGN KEY ("decided_by") REFERENCES "app_users"("id") ON DELETE SET NULL,
        CONSTRAINT "CK_contract_renewals_decided" CHECK (("status" = 'PENDING') = ("decided_at" IS NULL)),
        CONSTRAINT "CK_contract_renewals_approved" CHECK ("status" <> 'APPROVED' OR "previous_months" IS NOT NULL)
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_contract_renewals_pending" ON "contract_renewals" ("contract_id")
        WHERE "status" = 'PENDING'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_contract_renewals_status_created" ON "contract_renewals" ("status", "created_at" DESC)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "contract_renewals"`);
  }
}
