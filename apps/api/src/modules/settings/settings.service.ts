import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { Repository } from 'typeorm';
import { SystemSetting } from './entities/system-setting.entity';
import { SETTINGS_REGISTRY, validateSettingValue } from './settings.registry';
import {
  type SystemSettingsResponse,
  toSystemSettingRecord,
  type UpdateSettingsResponse,
} from './types/settings';

/** Settings change rarely — a short TTL lets other instances pick up updates without invalidation plumbing. */
const CACHE_TTL_MS = 60_000;

@Injectable()
export class SettingsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SettingsService.name);
  private readonly cache = new Map<string, { value: unknown; loadedAt: number }>();

  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingsRepo: Repository<SystemSetting>,
  ) {}

  /** Inserts every registry key missing from the DB so defaults always exist. */
  async onApplicationBootstrap(): Promise<void> {
    const params: unknown[] = [];
    const placeholders = Object.entries(SETTINGS_REGISTRY).map(([key, def], index) => {
      const base = index * 5;
      params.push(key, JSON.stringify(def.default), def.type, def.group, def.description ?? null);
      return `($${base + 1}, $${base + 2}::jsonb, $${base + 3}, $${base + 4}, $${base + 5})`;
    });

    // Atomic and idempotent: concurrent instance boots cannot double-insert the same key.
    const inserted = (await this.settingsRepo.query(
      `INSERT INTO system_settings (key, value, value_type, "group", description)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (key) DO NOTHING
       RETURNING key`,
      params,
    )) as Array<{ key: string }>;

    if (inserted.length > 0) {
      this.logger.log(`Seeded ${inserted.length} missing system setting(s).`);
    }
  }

  /** Reads a setting value, served from a short-TTL in-memory cache. */
  async get(key: string): Promise<unknown> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
      return cached.value;
    }

    const row = await this.settingsRepo.findOne({ where: { key } });
    const value = row?.value ?? SETTINGS_REGISTRY[key]?.default;
    if (value === undefined) {
      throw new DomainException(
        ErrorCode.INTERNAL_ERROR,
        `System setting '${key}' is not defined`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.cache.set(key, { value, loadedAt: Date.now() });
    return value;
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

  /** Lists every setting merged with its registry metadata (label, default, min/max). */
  async getAll(): Promise<SystemSettingsResponse> {
    const rows = await this.settingsRepo.find({ order: { group: 'ASC', key: 'ASC' } });
    return { settings: rows.map(toSystemSettingRecord) };
  }

  /** Validates and applies a partial update of one or more settings. */
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

    const fieldErrors = entries.flatMap(([key, value]) => {
      const error = validateSettingValue(key, value);
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

    await this.settingsRepo.save(
      entries.map(([key, value]) =>
        this.settingsRepo.create({
          key,
          value,
          valueType: SETTINGS_REGISTRY[key].type,
          group: SETTINGS_REGISTRY[key].group,
          updatedBy: admin.id,
        }),
      ),
    );
    for (const [key] of entries) {
      this.cache.delete(key);
    }

    const rows = await this.settingsRepo.find({
      where: entries.map(([key]) => ({ key })),
      order: { group: 'ASC', key: 'ASC' },
    });
    return { settings: rows.map(toSystemSettingRecord) };
  }
}
