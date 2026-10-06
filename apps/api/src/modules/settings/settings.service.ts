import { SystemSetting } from '@entities/system-setting.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { In, Repository } from 'typeorm';
import {
  type SystemSettingsResponse,
  toSystemSettingRecord,
  type UpdateSettingsResponse,
} from './types/settings';

/** Settings change rarely — a short TTL lets other instances pick up updates without invalidation plumbing. */
const CACHE_TTL_MS = 60_000;

@Injectable()
export class SettingsService {
  private readonly cache = new Map<string, { value: unknown; loadedAt: number }>();

  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingsRepo: Repository<SystemSetting>,
  ) {}

  /** Reads a setting value, served from a short-TTL in-memory cache. */
  async get(key: string): Promise<unknown> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
      return cached.value;
    }

    const row = await this.settingsRepo.findOne({ where: { key } });
    if (!row) {
      throw new DomainException(
        ErrorCode.INTERNAL_ERROR,
        `System setting '${key}' is not defined`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.cache.set(key, { value: row.value, loadedAt: Date.now() });
    return row.value;
  }

  private async getNumber(key: string): Promise<number> {
    const value = await this.get(key);
    return typeof value === 'number' ? value : Number(value);
  }

  // Typed getters — one per business rule consumed by other modules.

  async getBookingHoldMinutes(): Promise<number> {
    return this.getNumber('booking.hold_minutes');
  }

  async getBookingLeadDays(): Promise<number> {
    return this.getNumber('booking.lead_days');
  }

  async getBookingMinRentalMonths(): Promise<number> {
    return this.getNumber('booking.min_rental_months');
  }

  async getBookingMaxRentalMonths(): Promise<number> {
    return this.getNumber('booking.max_rental_months');
  }

  async getBookingDefaultRentalMonths(): Promise<number> {
    return this.getNumber('booking.default_rental_months');
  }

  async getBookingRentalMonthsOptions(): Promise<number[]> {
    const value = await this.get('booking.rental_months_options');
    return Array.isArray(value) ? value.map((v) => Number(v)) : [];
  }

  async getBookingMaxUnitsPerBooking(): Promise<number> {
    return this.getNumber('booking.max_units_per_booking');
  }

  async getIdempotencyTtlHours(): Promise<number> {
    return this.getNumber('idempotency.ttl_hours');
  }

  async getIdempotencyStaleSeconds(): Promise<number> {
    return this.getNumber('idempotency.stale_seconds');
  }

  async getDepositDefaultMonths(): Promise<number> {
    return this.getNumber('deposit.default_months');
  }

  /** Lists every setting with its stored metadata (label, bounds, default). */
  async getAll(): Promise<SystemSettingsResponse> {
    const rows = await this.settingsRepo.find({ order: { group: 'ASC', key: 'ASC' } });
    return { settings: rows.map(toSystemSettingRecord) };
  }

  /** Validates each value against the row's stored type/bounds and applies a partial update. */
  async update(values: Record<string, unknown>, admin: AuthUser): Promise<UpdateSettingsResponse> {
    const entries = Object.entries(values);
    if (entries.length === 0) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Validation failed',
        HttpStatus.BAD_REQUEST,
        {
          fields: [
            {
              field: 'values',
              code: 'isEmpty',
              message: 'At least one setting is required to update',
            },
          ],
        },
      );
    }

    const keys = entries.map(([key]) => key);
    const rows = await this.settingsRepo.find({ where: { key: In(keys) } });
    const byKey = new Map(rows.map((row) => [row.key, row]));

    const fieldErrors = entries.flatMap(([key, value]) => {
      const row = byKey.get(key);
      const error = row ? validateSettingValue(row, value) : 'Unknown setting key';
      return error ? [{ field: key, code: 'invalidValue', message: error }] : [];
    });
    if (fieldErrors.length > 0) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Validation failed',
        HttpStatus.BAD_REQUEST,
        { fields: fieldErrors },
      );
    }

    // Only value and updated_by change — metadata columns belong to migrations, not admin edits.
    await Promise.all(
      entries.map(([key, value]) =>
        this.settingsRepo.update({ key }, { value, updatedBy: admin.id }),
      ),
    );
    for (const [key] of entries) {
      this.cache.delete(key);
    }

    const updated = await this.settingsRepo.find({
      where: { key: In(keys) },
      order: { group: 'ASC', key: 'ASC' },
    });
    return { settings: updated.map(toSystemSettingRecord) };
  }
}

/**
 * Validates a candidate value against the row's declared type and bounds.
 * Returns an error message, or `null` when the value is valid.
 */
function validateSettingValue(row: SystemSetting, value: unknown): string | null {
  const { min, max } = row;

  switch (row.valueType) {
    case 'int':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return 'Value must be an integer';
      }
      break;
    case 'float':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 'Value must be a number';
      }
      break;
    case 'string':
      if (typeof value !== 'string') {
        return 'Value must be a string';
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        return 'Value must be a boolean';
      }
      break;
    case 'duration_minutes':
      if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
        return 'Value must be a positive integer number of minutes';
      }
      break;
    case 'int_list':
      if (
        !Array.isArray(value) ||
        !value.every((v) => typeof v === 'number' && Number.isInteger(v))
      ) {
        return 'Value must be an array of integers';
      }
      if (min != null && value.some((v) => v < min)) {
        return `Each item must be >= ${min}`;
      }
      if (max != null && value.some((v) => v > max)) {
        return `Each item must be <= ${max}`;
      }
      break;
  }

  if (row.valueType !== 'string' && row.valueType !== 'boolean' && row.valueType !== 'int_list') {
    const numeric = value as number;
    if (min != null && numeric < min) {
      return `Value must be >= ${min}`;
    }
    if (max != null && numeric > max) {
      return `Value must be <= ${max}`;
    }
  }

  return null;
}
