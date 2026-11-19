import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A shelf contract has no handover to carry an assignee, so the contract itself names the staff
 * member who takes the signed files and the first month at the counter, given round robin like
 * handovers. Additive and nullable: contracts made before stay unassigned, and the instance still
 * serving during a deploy keeps writing them unassigned.
 */
export class ShelfContractAssignee1792180000000 implements MigrationInterface {
  name = 'ShelfContractAssignee1792180000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contracts"
         ADD COLUMN "assigned_to" uuid,
         ADD COLUMN "assigned_at" timestamptz,
         ADD CONSTRAINT "FK_contracts_assigned_to" FOREIGN KEY ("assigned_to")
           REFERENCES "app_users"("id") ON DELETE SET NULL`,
    );
    // The rotation reads the latest assignment of a facility; staff list their open ones.
    await queryRunner.query(
      `CREATE INDEX "IDX_contracts_assigned_at" ON "contracts" ("assigned_at" DESC)
        WHERE "assigned_to" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_contracts_assigned_to_draft" ON "contracts" ("assigned_to")
        WHERE "status" = 'DRAFT'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_contracts_assigned_to_draft"`);
    await queryRunner.query(`DROP INDEX "IDX_contracts_assigned_at"`);
    await queryRunner.query(
      `ALTER TABLE "contracts"
         DROP CONSTRAINT "FK_contracts_assigned_to",
         DROP COLUMN "assigned_at",
         DROP COLUMN "assigned_to"`,
    );
  }
}
