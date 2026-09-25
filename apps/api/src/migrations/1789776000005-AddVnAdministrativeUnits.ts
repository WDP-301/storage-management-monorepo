import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Vietnam administrative units (post-2025 two-level model: 34 provinces -> wards,
 * no districts). Schema + seed data come from the vietnamese-provinces-database
 * dataset (v5.2.0, decree 388/NQ-UBTVQH16); `data/vn-admin-units.sql` keeps only
 * the provinces/wards INSERTs verbatim — refresh = re-download + drop the
 * regions/units/metadata sections again.
 *
 * `administrative_unit_id` is kept as a plain int (no FK): dataset unit ids are
 * 1=Thành phố TW, 2=Tỉnh, 3=Phường, 4=Xã, 5=Đặc khu.
 */
export class AddVnAdministrativeUnits1789776000005 implements MigrationInterface {
  name = 'AddVnAdministrativeUnits1789776000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const statements = [
      `CREATE TABLE provinces (
        code varchar(20) NOT NULL,
        name varchar(255) NOT NULL,
        name_en varchar(255) NULL,
        full_name varchar(255) NOT NULL,
        full_name_en varchar(255) NULL,
        code_name varchar(255) NULL,
        postal_code_prefix varchar(255) NULL,
        administrative_unit_id integer NULL,
        CONSTRAINT provinces_pkey PRIMARY KEY (code)
      )`,
      `CREATE TABLE wards (
        code varchar(20) NOT NULL,
        name varchar(255) NOT NULL,
        name_en varchar(255) NULL,
        full_name varchar(255) NULL,
        full_name_en varchar(255) NULL,
        code_name varchar(255) NULL,
        postal_code varchar(20) NULL,
        province_code varchar(20) NULL,
        administrative_unit_id integer NULL,
        CONSTRAINT wards_pkey PRIMARY KEY (code)
      )`,
      `ALTER TABLE wards ADD CONSTRAINT wards_province_code_fkey FOREIGN KEY (province_code) REFERENCES provinces(code)`,
      `CREATE INDEX idx_wards_province ON wards(province_code)`,
    ];

    for (const statement of statements) await queryRunner.query(statement);

    const seed = readFileSync(join(__dirname, 'data', 'vn-admin-units.sql'), 'utf8');
    await queryRunner.query(seed);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "wards"`);
    await queryRunner.query(`DROP TABLE "provinces"`);
  }
}
