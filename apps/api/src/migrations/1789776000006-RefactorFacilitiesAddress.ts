import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refactor `facilities` address from free-text (ward/district/city) to
 * structured VN administrative codes:
 *   - ward_code     → FK → wards(code)
 *   - province_code → FK → provinces(code)
 *
 * Both columns are nullable because existing rows have no code values.
 * The legacy ward/district/city columns are dropped after adding the new ones.
 */
export class RefactorFacilitiesAddress1789776000006 implements MigrationInterface {
  name = 'RefactorFacilitiesAddress1789776000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add new columns (nullable — existing rows have no ward/province codes)
    await queryRunner.query(`ALTER TABLE "facilities" ADD COLUMN "province_code" varchar(20) NULL`);
    await queryRunner.query(`ALTER TABLE "facilities" ADD COLUMN "ward_code" varchar(20) NULL`);

    // 2. Add FK constraints
    await queryRunner.query(
      `ALTER TABLE "facilities"
       ADD CONSTRAINT "fk_facilities_province_code"
       FOREIGN KEY ("province_code") REFERENCES "provinces"("code")
       ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "facilities"
       ADD CONSTRAINT "fk_facilities_ward_code"
       FOREIGN KEY ("ward_code") REFERENCES "wards"("code")
       ON DELETE SET NULL ON UPDATE CASCADE`,
    );

    // 3. Drop legacy free-text columns
    await queryRunner.query(`ALTER TABLE "facilities" DROP COLUMN "city"`);
    await queryRunner.query(`ALTER TABLE "facilities" DROP COLUMN "district"`);
    await queryRunner.query(`ALTER TABLE "facilities" DROP COLUMN "ward"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop FK constraints first
    await queryRunner.query(`ALTER TABLE "facilities" DROP CONSTRAINT "fk_facilities_ward_code"`);
    await queryRunner.query(
      `ALTER TABLE "facilities" DROP CONSTRAINT "fk_facilities_province_code"`,
    );

    // 2. Drop new columns
    await queryRunner.query(`ALTER TABLE "facilities" DROP COLUMN "ward_code"`);
    await queryRunner.query(`ALTER TABLE "facilities" DROP COLUMN "province_code"`);

    // 3. Restore legacy columns (nullable since original data is gone)
    await queryRunner.query(`ALTER TABLE "facilities" ADD COLUMN "ward" varchar(100) NULL`);
    await queryRunner.query(`ALTER TABLE "facilities" ADD COLUMN "district" varchar(100) NULL`);
    await queryRunner.query(`ALTER TABLE "facilities" ADD COLUMN "city" varchar(100) NULL`);
  }
}
