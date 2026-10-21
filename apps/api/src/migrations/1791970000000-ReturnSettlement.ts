import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Deposits the business reviewed by hand because the formula below cannot tell them apart
 * (several items of one booking changed unit, or another item lost its contracts in
 * PurgeEndedContracts): contract_no → amount in VND. A reviewed amount always wins over the
 * formula (a difference is logged). A listed contract that is missing, no longer DRAFT/ACTIVE,
 * not on a CONFIRMED booking, or on the same booking item as another listed one aborts the
 * migration so the list is reviewed again rather than silently skipped.
 */
const REVIEWED_DEPOSITS: Record<string, number> = {};

const RETURN_RULES_BEFORE_GO_LIVE = '{"noticeDays":30,"penaltyPercent":100}';

interface Reviewed {
  id: string;
  item_id: string;
  booking_id: string;
  booking_status: string;
  /** What the formula would record; null when it cannot derive the item. */
  formula: string | null;
}

/**
 * Deposit paid per booking item of a CONFIRMED booking (NULL amount when it cannot be derived)
 * and the latest successful deposit transfer. A completed unit change overwrites the item's
 * deposit snapshot while the booking total keeps what was paid. Subtracting the other items'
 * snapshots is only trusted while every other item still has a contract: PurgeEndedContracts
 * removed ended contracts together with the change requests showing an overwritten snapshot.
 * Same derivation as the runtime resolver (`paidDepositByItemSql`), copied so this migration
 * keeps its meaning if that changes.
 */
const PAID_DEPOSIT_BY_ITEM = `
  WITH items AS (
    SELECT o."id", o."booking_id", o."deposit_snapshot",
           EXISTS (SELECT 1 FROM "contracts" c JOIN "unit_change_requests" r ON r."contract_id" = c."id"
                    WHERE c."booking_item_id" = o."id" AND r."status" = 'COMPLETED') AS changed,
           EXISTS (SELECT 1 FROM "contracts" c WHERE c."booking_item_id" = o."id") AS has_contract
      FROM "booking_items" o
  ), per_booking AS (
    SELECT "booking_id", count(*) AS item_count, sum("deposit_snapshot") AS snapshot_sum,
           count(*) FILTER (WHERE changed) AS changed_count,
           count(*) FILTER (WHERE NOT has_contract) AS contractless_count
      FROM items GROUP BY "booking_id"
  )
  SELECT i."id" AS item_id,
         CASE
           WHEN pb.item_count = 1 THEN b."deposit_total"
           WHEN NOT i.changed THEN i."deposit_snapshot"
           WHEN pb.changed_count = 1 AND pb.contractless_count = 0
            AND b."deposit_total" - (pb.snapshot_sum - i."deposit_snapshot") >= 0
             THEN b."deposit_total" - (pb.snapshot_sum - i."deposit_snapshot")
         END AS amount,
         (SELECT p."id" FROM "payments" p
           WHERE p."booking_id" = b."id" AND p."type" = 'DEPOSIT' AND p."status" = 'SUCCEEDED'
           ORDER BY p."created_at" DESC, p."id" DESC LIMIT 1) AS payment_id
    FROM items i
    JOIN per_booking pb ON pb."booking_id" = i."booking_id"
    JOIN "bookings" b ON b."id" = i."booking_id" AND b."status" = 'CONFIRMED'`;

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
 * Deposit settlement at the end of a rental: `contract_settlements` (the approved settlement),
 * SETTLEMENT invoices and DEPOSIT payments (money taken from the held deposit), return request
 * details on `inspections`, a pre-fill refund account on `customer_profiles`, the return rule
 * settings, and a deposit ledger backfilled for live contracts.
 */
export class ReturnSettlement1791970000000 implements MigrationInterface {
  name = 'ReturnSettlement1791970000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '3s'`);

    await dropColumnChecks(queryRunner, 'invoices', 'kind');
    await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "CK_invoices_kind"
      CHECK ("kind" IN ('INITIAL', 'RENEWAL', 'SETTLEMENT'))`);
    await dropColumnChecks(queryRunner, 'payments', 'method');
    await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "CK_payments_method"
      CHECK ("method" IN ('CASH', 'BANK_TRANSFER', 'VNPAY', 'MOMO', 'SIMULATED', 'DEPOSIT'))`);
    // A settlement invoice is billed once per contract outside the rental periods.
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_invoices_contract_period"`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_invoices_contract_period" ON "invoices" ("contract_id", "period_no")
      WHERE "contract_id" IS NOT NULL AND "status" <> 'VOID' AND "kind" <> 'SETTLEMENT'`);

    await queryRunner.query(`CREATE TABLE "contract_settlements" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
      "contract_id" uuid NOT NULL, "deposit_id" uuid NOT NULL, "status" varchar(20) NOT NULL,
      "lines" jsonb NOT NULL DEFAULT '[]',
      "deposit_amount" numeric(14,2) NOT NULL DEFAULT 0, "credits_total" numeric(14,2) NOT NULL DEFAULT 0,
      "deductions_total" numeric(14,2) NOT NULL DEFAULT 0, "refund_amount" numeric(14,2) NOT NULL DEFAULT 0,
      "shortfall_amount" numeric(14,2) NOT NULL DEFAULT 0,
      "fee_invoice_id" uuid, "customer_bank_account" jsonb, "bank_account" jsonb,
      "bank_override_by" uuid, "bank_override_reason" text, "transfer_ref" varchar(100),
      "evidence" jsonb NOT NULL DEFAULT '[]', "note" text,
      "approved_by" uuid, "approved_at" timestamptz NOT NULL, "completed_by" uuid, "completed_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_contract_settlements_contract" UNIQUE ("contract_id"),
      CONSTRAINT "FK_contract_settlements_contract" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_contract_settlements_deposit" FOREIGN KEY ("deposit_id") REFERENCES "deposits"("id"),
      CONSTRAINT "FK_contract_settlements_fee_invoice" FOREIGN KEY ("fee_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL,
      CONSTRAINT "FK_contract_settlements_override_by" FOREIGN KEY ("bank_override_by") REFERENCES "app_users"("id") ON DELETE SET NULL,
      CONSTRAINT "FK_contract_settlements_approved_by" FOREIGN KEY ("approved_by") REFERENCES "app_users"("id") ON DELETE SET NULL,
      CONSTRAINT "FK_contract_settlements_completed_by" FOREIGN KEY ("completed_by") REFERENCES "app_users"("id") ON DELETE SET NULL,
      CONSTRAINT "CK_contract_settlements_status" CHECK ("status" IN ('AWAITING_REFUND', 'COMPLETED')),
      CONSTRAINT "CK_contract_settlements_amounts" CHECK ("deposit_amount" >= 0 AND "credits_total" >= 0
        AND "deductions_total" >= 0 AND "refund_amount" >= 0 AND "shortfall_amount" >= 0),
      CONSTRAINT "CK_contract_settlements_completed" CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL)),
      CONSTRAINT "CK_contract_settlements_override_reason" CHECK ("bank_override_by" IS NULL OR "bank_override_reason" IS NOT NULL)
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_contract_settlements_transfer_ref"
      ON "contract_settlements" ("transfer_ref") WHERE "transfer_ref" IS NOT NULL`);

    // All nullable: handover inspections have none of these.
    await queryRunner.query(`ALTER TABLE "inspections"
      ADD COLUMN "notice_from" timestamptz, ADD COLUMN "returned_on" date,
      ADD COLUMN "refund_account" jsonb, ADD COLUMN "return_rules" jsonb,
      ADD COLUMN "requested_by" uuid, ADD COLUMN "request_source" varchar(20),
      ADD CONSTRAINT "FK_inspections_requested_by" FOREIGN KEY ("requested_by") REFERENCES "app_users"("id") ON DELETE SET NULL,
      ADD CONSTRAINT "CK_inspections_request_source" CHECK ("request_source" IN ('CUSTOMER', 'HOTLINE', 'ABANDONED'))`);
    await queryRunner.query(
      `ALTER TABLE "customer_profiles" ADD COLUMN "refund_bank_account" jsonb`,
    );

    await queryRunner.query(`
      INSERT INTO "system_settings"
        ("key", "value", "value_type", "group", "description", "label", "default_value", "min", "max")
      VALUES
        ('contract.return_notice_days', '30', 'int', 'contract', 'A customer returning a unit before the end of the term must give at least this many days of notice, otherwise one month of rent is deducted from the deposit.', 'Return notice (days)', '30', 0, 180),
        ('billing.overdue_penalty_percent', '100', 'int', 'billing', 'Charge for each day a unit is kept past the end of the term, as a percentage of one day of rent (monthly rent / 30), deducted from the deposit.', 'Overstay charge (% of daily rent)', '100', 0, 500),
        ('contract.return_rules_effective_at', to_jsonb(now()), 'string', 'contract', 'When the return notice and overstay rules took effect; contracts already overdue then are charged from this moment only. Set once, not editable.', 'Return rules effective at', NULL, NULL, NULL)
      ON CONFLICT ("key") DO NOTHING`);

    // Open return requests predate the rules: their notice runs from when they were made.
    await queryRunner.query(
      `UPDATE "inspections" i
          SET "notice_from" = i."created_at", "return_rules" = $1::jsonb,
              "request_source" = 'CUSTOMER', "requested_by" = c."customer_id"
         FROM "contracts" c
        WHERE c."id" = i."contract_id" AND i."type" = 'RETURN' AND i."notice_from" IS NULL`,
      [RETURN_RULES_BEFORE_GO_LIVE],
    );
    await this.backfillDeposits(queryRunner);
  }

  /** One deposit row per booking item, on its live contract (INITIAL first). */
  private async backfillDeposits(queryRunner: QueryRunner): Promise<void> {
    const reviewedItems = new Map<string, string>();
    for (const [contractNo, amount] of Object.entries(REVIEWED_DEPOSITS)) {
      const fail = (reason: string): never => {
        throw new Error(`ReturnSettlement: reviewed deposit of ${contractNo} ${reason}`);
      };
      if (!Number.isFinite(amount) || amount < 0) fail(`is invalid: ${amount}`);
      const [contract]: Reviewed[] = await queryRunner.query(
        `SELECT c."id", bi."id" AS "item_id", b."id" AS "booking_id", b."status" AS "booking_status",
                (SELECT f.amount FROM (${PAID_DEPOSIT_BY_ITEM}) f WHERE f.item_id = bi."id") AS "formula"
           FROM "contracts" c
           JOIN "booking_items" bi ON bi."id" = c."booking_item_id"
           JOIN "bookings" b ON b."id" = bi."booking_id"
          WHERE c."contract_no" = $1 AND c."status" IN ('DRAFT', 'ACTIVE') AND c."deleted_at" IS NULL`,
        [contractNo],
      );
      if (!contract) fail('names a contract that is missing or no longer DRAFT/ACTIVE');
      // Only a confirmed booking has paid its deposit; anything else needs a new review.
      if (contract.booking_status !== 'CONFIRMED') {
        fail(`belongs to a ${contract.booking_status} booking`);
      }
      const twin = reviewedItems.get(contract.item_id);
      if (twin) fail(`is for the same booking item as ${twin}; one deposit per item`);
      reviewedItems.set(contract.item_id, contractNo);
      if (contract.formula !== null && Number(contract.formula) !== amount) {
        console.log(
          `ReturnSettlement: reviewed deposit of ${contractNo} is ${amount}, the formula gives ${contract.formula}; using the reviewed amount`,
        );
      }
      await queryRunner.query(
        `INSERT INTO "deposits" ("contract_id", "payment_id", "amount_snapshot", "held_amount", "status")
         SELECT $1::uuid, (SELECT p."id" FROM "payments" p WHERE p."booking_id" = $2 AND p."type" = 'DEPOSIT'
                       AND p."status" = 'SUCCEEDED' ORDER BY p."created_at" DESC, p."id" DESC LIMIT 1),
                $3::numeric, $3::numeric, 'HELD'
         ON CONFLICT ("contract_id") DO NOTHING`,
        [contract.id, contract.booking_id, amount],
      );
      const [{ amount_snapshot }] = await queryRunner.query(
        `SELECT "amount_snapshot" FROM "deposits" WHERE "contract_id" = $1`,
        [contract.id],
      );
      if (Number(amount_snapshot) !== amount) fail(`conflicts with a recorded ${amount_snapshot}`);
    }

    const inserted: unknown[] = await queryRunner.query(`
      INSERT INTO "deposits" ("contract_id", "payment_id", "amount_snapshot", "held_amount", "status")
      SELECT t."id", f.payment_id, f.amount, f.amount, 'HELD'
        FROM (SELECT DISTINCT ON (c."booking_item_id") c."id", c."booking_item_id"
                FROM "contracts" c
               WHERE c."status" IN ('DRAFT', 'ACTIVE') AND c."deleted_at" IS NULL
               ORDER BY c."booking_item_id", (c."kind" = 'INITIAL') DESC, c."created_at", c."id") t
        JOIN (${PAID_DEPOSIT_BY_ITEM}) f ON f.item_id = t."booking_item_id"
       WHERE f.amount IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM "deposits" x JOIN "contracts" xc ON xc."id" = x."contract_id"
                          WHERE xc."booking_item_id" = t."booking_item_id")
      ON CONFLICT ("contract_id") DO NOTHING
      RETURNING "id"`);

    const unresolved: { contract_no: string }[] = await queryRunner.query(`
      SELECT c."contract_no" FROM "contracts" c
        JOIN "booking_items" bi ON bi."id" = c."booking_item_id"
        JOIN "bookings" b ON b."id" = bi."booking_id" AND b."status" = 'CONFIRMED'
       WHERE c."status" IN ('DRAFT', 'ACTIVE') AND c."deleted_at" IS NULL
         AND NOT EXISTS (SELECT 1 FROM "deposits" x JOIN "contracts" xc ON xc."id" = x."contract_id"
                          WHERE xc."booking_item_id" = c."booking_item_id")
       ORDER BY c."contract_no"`);
    console.log(
      `ReturnSettlement: deposits recorded ${inserted.length} by formula, ` +
        `${Object.keys(REVIEWED_DEPOSITS).length} reviewed; not derivable: ` +
        `${unresolved.map((row) => row.contract_no).join(', ') || 'none'}`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [{ settlements, invoices, payments }] = await queryRunner.query(`SELECT
      (SELECT count(*) FROM "contract_settlements")::int AS settlements,
      (SELECT count(*) FROM "invoices" WHERE "kind" = 'SETTLEMENT')::int AS invoices,
      (SELECT count(*) FROM "payments" WHERE "method" = 'DEPOSIT')::int AS payments`);
    if (settlements + invoices + payments > 0) {
      throw new Error(
        `ReturnSettlement cannot be reverted: ${settlements} settlement(s), ${invoices} settlement invoice(s) and ${payments} deposit payment(s) exist`,
      );
    }
    await queryRunner.query(`DELETE FROM "deposits"`);
    await queryRunner.query(`DELETE FROM "system_settings" WHERE "key" IN
      ('contract.return_notice_days', 'billing.overdue_penalty_percent', 'contract.return_rules_effective_at')`);
    await queryRunner.query(`ALTER TABLE "customer_profiles" DROP COLUMN "refund_bank_account"`);
    await queryRunner.query(`ALTER TABLE "inspections"
      DROP CONSTRAINT "CK_inspections_request_source", DROP CONSTRAINT "FK_inspections_requested_by",
      DROP COLUMN "request_source", DROP COLUMN "requested_by", DROP COLUMN "return_rules",
      DROP COLUMN "refund_account", DROP COLUMN "returned_on", DROP COLUMN "notice_from"`);
    await queryRunner.query(`DROP TABLE "contract_settlements"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_invoices_contract_period"`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_invoices_contract_period" ON "invoices" ("contract_id", "period_no")
      WHERE "contract_id" IS NOT NULL AND "status" <> 'VOID'`);
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "CK_payments_method",
      ADD CONSTRAINT "payments_method_check" CHECK ("method" IN ('CASH', 'BANK_TRANSFER', 'VNPAY', 'MOMO', 'SIMULATED'))`);
    await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "CK_invoices_kind",
      ADD CONSTRAINT "invoices_kind_check" CHECK ("kind" IN ('INITIAL', 'RENEWAL'))`);
  }
}
