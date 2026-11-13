import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A unit change cancels the old contract and mints a new one for the destination unit. The
 * cancellation is recorded on a free-text `note` ("khách đổi kho mới") — distinct from
 * `contract_settlements.note`, because no settlement is created for a move.
 */
export class ContractNote1792100000000 implements MigrationInterface {
  name = 'ContractNote1792100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "contracts" ADD COLUMN "note" text`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN "note"`);
  }
}
