import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Warehouse amenities frozen into the contract when it is created, so later edits to the
 * warehouse do not rewrite what the customer was promised. NULL means "not recorded" (contracts
 * made before this column existed) and is distinct from [] ("the warehouse had no amenities").
 * Existing rows are deliberately not backfilled: today's amenities cannot prove what the
 * warehouse offered when the rental began.
 */
export class ContractAmenitiesSnapshot1791960000000 implements MigrationInterface {
  name = 'ContractAmenitiesSnapshot1791960000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "contracts" ADD "amenities_snapshot" jsonb`);
  }

  /** Reverting discards every snapshot already written; the data cannot be reconstructed. */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN "amenities_snapshot"`);
  }
}
