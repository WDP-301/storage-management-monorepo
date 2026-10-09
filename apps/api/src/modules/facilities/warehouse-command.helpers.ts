import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import {
  PG_CHECK_VIOLATION,
  PG_FK_VIOLATION,
  PG_NUMERIC_OVERFLOW,
  PG_UNIQUE_VIOLATION,
  pgErrorCode,
} from '@shared/utils/pg-error.util';
import type { EntityManager } from 'typeorm';
import type { UpdateWarehouseDto } from './dto/warehouse.dto';

export function pick<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

/** Fields a client may clear with `null`; every other field must be omitted or given a value. */
const CLEARABLE_FIELDS = new Set(['depositMonths', 'notes', 'wardCode']);

// `@IsOptional` lets `null` through validation, which would otherwise reach a NOT NULL column.
export function assertNoNullRequiredFields(dto: UpdateWarehouseDto): void {
  const fields = Object.entries(dto)
    .filter(([key, value]) => value === null && !CLEARABLE_FIELDS.has(key))
    .map(([field]) => ({ field, code: 'isNotEmpty', message: `${field} cannot be null` }));
  if (fields.length > 0) {
    throw new DomainException(
      ErrorCode.VALIDATION_FAILED,
      'Validation failed',
      HttpStatus.BAD_REQUEST,
      { fields },
    );
  }
}

export function handleDbError(err: unknown): never {
  const code = pgErrorCode(err);
  if (code === PG_UNIQUE_VIOLATION) {
    throw new DomainException(
      ErrorCode.CONFLICT,
      'Warehouse code already exists',
      HttpStatus.CONFLICT,
    );
  }
  if (code === PG_FK_VIOLATION) {
    throw new DomainException(
      ErrorCode.BAD_REQUEST,
      'facilityId, provinceCode or wardCode does not exist',
      HttpStatus.BAD_REQUEST,
    );
  }
  if (code === PG_CHECK_VIOLATION || code === PG_NUMERIC_OVERFLOW) {
    throw new DomainException(
      ErrorCode.VALIDATION_FAILED,
      'Warehouse values are out of range',
      HttpStatus.BAD_REQUEST,
    );
  }
  throw err;
}

/**
 * A ward must belong to the warehouse's province; when only the ward is given the province
 * is derived from it, so the two codes can never disagree.
 */
export async function resolveAddressCodes(
  manager: EntityManager,
  wardCode: string | null | undefined,
  provinceCode: string | null | undefined,
): Promise<{ wardCode?: string; provinceCode?: string }> {
  if (!wardCode) return {};

  const rows: { province_code: string }[] = await manager.query(
    'SELECT province_code FROM wards WHERE code = $1',
    [wardCode],
  );
  const wardProvince = rows[0]?.province_code;
  if (!wardProvince) {
    throw new DomainException(
      ErrorCode.BAD_REQUEST,
      `Ward ${wardCode} does not exist`,
      HttpStatus.BAD_REQUEST,
    );
  }
  if (provinceCode && provinceCode !== wardProvince) {
    throw new DomainException(
      ErrorCode.VALIDATION_FAILED,
      `Ward ${wardCode} does not belong to province ${provinceCode}`,
      HttpStatus.BAD_REQUEST,
    );
  }
  return { wardCode, provinceCode: wardProvince };
}
