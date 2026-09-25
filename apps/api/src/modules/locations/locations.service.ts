import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

const PROVINCE_COLUMNS = `code, name, name_en AS "nameEn", full_name AS "fullName",
  full_name_en AS "fullNameEn", code_name AS "codeName"`;

@Injectable()
export class LocationsService {
  constructor(private readonly dataSource: DataSource) {}

  listProvinces() {
    return this.dataSource.query(`SELECT ${PROVINCE_COLUMNS} FROM provinces ORDER BY name`);
  }

  listWards(provinceCode: string) {
    return this.dataSource.query(
      `SELECT ${PROVINCE_COLUMNS}, province_code AS "provinceCode" FROM wards WHERE province_code = $1 ORDER BY name`,
      [provinceCode],
    );
  }
}
