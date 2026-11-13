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
 * The unit-change flow becomes a two-approval, booking-like journey: L1 approval bills a deposit
 * top-up (AWAITING_PAYMENT) or settles on the spot; on payment the old contract is cancelled and a
 * destination contract is created (AWAITING_HANDOVER); the signed handover moves it to
 * AWAITING_FINAL_APPROVAL; the L2 approval completes it. This migration retires the old
 * one-approval in-flight rows and adds the columns/indexes/status CHECK the new flow needs.
 */
export class UnitChangeTwoStepApproval1792110000000 implements MigrationInterface {
  name = 'UnitChangeTwoStepApproval1792110000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '3s'`);

    // 1. Retire in-flight rows of the old one-approval flow: give back any held unit and void an
    //    unpaid top-up, then cancel — the new flow cannot continue them.
    await queryRunner.query(`
      UPDATE "storage_units" su SET status = 'AVAILABLE'
        FROM "unit_change_requests" r
       WHERE su."id" = r."new_unit_id" AND su."status" = 'HELD'
         AND r."status" IN ('PROPOSED','APPROVED','TRANSITIONING')`);
    await queryRunner.query(`
      UPDATE "invoices" i SET status = 'VOID'
        FROM "unit_change_requests" r
       WHERE i."id" = r."topup_invoice_id" AND i."status" = 'ISSUED'
         AND r."status" IN ('PROPOSED','APPROVED','TRANSITIONING')
         AND NOT EXISTS (SELECT 1 FROM "payments" p
                          WHERE p."invoice_id" = i."id" AND p."status" = 'SUCCEEDED')`);
    await queryRunner.query(`
      UPDATE "unit_change_requests" r
         SET "status" = 'CANCELLED',
             "transition_end_at" = now(),
             "history" = r."history" || jsonb_build_object(
               'action','STATUS_CHANGED','from',r."status",'to','CANCELLED',
               'at',now(),'by','system',
               'reason','Quy trình đổi kho được thay bằng quy trình duyệt hai bước')
       WHERE r."status" IN ('PROPOSED','APPROVED','TRANSITIONING')`);

    // 2. Destination contract/booking columns.
    await queryRunner.query(`ALTER TABLE "unit_change_requests"
      ADD COLUMN "new_contract_id"   uuid,
      ADD COLUMN "new_booking_id"    uuid,
      ADD COLUMN "settled_at"        timestamptz,
      ADD COLUMN "final_approved_by" uuid,
      ADD COLUMN "final_approved_at" timestamptz`);
    await queryRunner.query(`ALTER TABLE "unit_change_requests"
      ADD CONSTRAINT "FK_change_new_contract" FOREIGN KEY ("new_contract_id")
        REFERENCES "contracts"("id") ON DELETE SET NULL,
      ADD CONSTRAINT "FK_change_new_booking" FOREIGN KEY ("new_booking_id")
        REFERENCES "bookings"("id") ON DELETE SET NULL,
      ADD CONSTRAINT "FK_change_final_approver" FOREIGN KEY ("final_approved_by")
        REFERENCES "app_users"("id") ON DELETE SET NULL`);
    // One destination contract and one top-up invoice per request — the settle step's real guards.
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_change_request_new_contract"
      ON "unit_change_requests" ("new_contract_id") WHERE "new_contract_id" IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_change_request_topup_invoice"
      ON "unit_change_requests" ("topup_invoice_id") WHERE "topup_invoice_id" IS NOT NULL`);

    // 3. Widen the status CHECK (legacy values kept so historical rows stay valid).
    await dropColumnChecks(queryRunner, 'unit_change_requests', 'status');
    await queryRunner.query(`ALTER TABLE "unit_change_requests" ADD CONSTRAINT "CK_unit_change_requests_status"
      CHECK ("status" IN ('REQUESTED','AWAITING_PAYMENT','AWAITING_HANDOVER','AWAITING_FINAL_APPROVAL',
                          'COMPLETED','REJECTED','CANCELLED',
                          'PROPOSED','APPROVED','TRANSITIONING'))`);

    // 4. One open request per contract, over the new open set.
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_open_change_request"`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_open_change_request" ON "unit_change_requests" ("contract_id")
      WHERE "status" IN ('REQUESTED','AWAITING_PAYMENT','AWAITING_HANDOVER','AWAITING_FINAL_APPROVAL')`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_open_change_request"`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_open_change_request" ON "unit_change_requests" ("contract_id")
      WHERE "status" IN ('REQUESTED','PROPOSED','APPROVED','TRANSITIONING')`);
    await dropColumnChecks(queryRunner, 'unit_change_requests', 'status');
    await queryRunner.query(`ALTER TABLE "unit_change_requests" ADD CONSTRAINT "CK_unit_change_requests_status"
      CHECK ("status" IN ('REQUESTED','PROPOSED','APPROVED','TRANSITIONING','COMPLETED','REJECTED','CANCELLED'))`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_change_request_topup_invoice"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_change_request_new_contract"`);
    await queryRunner.query(`ALTER TABLE "unit_change_requests"
      DROP CONSTRAINT "FK_change_final_approver",
      DROP CONSTRAINT "FK_change_new_booking",
      DROP CONSTRAINT "FK_change_new_contract",
      DROP COLUMN "final_approved_at",
      DROP COLUMN "final_approved_by",
      DROP COLUMN "settled_at",
      DROP COLUMN "new_booking_id",
      DROP COLUMN "new_contract_id"`);
  }
}
