import type { StorageUnit } from '@entities/storage-unit.entity';
import { SystemSetting } from '@entities/system-setting.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import type { OverdueReminderSchedule } from '@modules/invoices/overdue-reminder.util';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, fieldValidationError } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import type { ClientSettingsResponse, ClientUnitChangeSettings } from '@storage/types';
import { In, Not, Repository } from 'typeorm';
import { loadClientSettings } from './client-settings';
import { rentalTermsFor, sortRentalTerms } from './rental-terms.util';
import { validateSettingValue } from './setting-value.validator';
import {
  type SystemSettingsResponse,
  toSystemSettingRecord,
  type UpdateSettingsResponse,
} from './types/settings';

/** Settings change rarely — a short TTL lets other instances pick up updates without invalidation plumbing. */
const CACHE_TTL_MS = 60_000;

/**
 * When the return rules went live. Contracts already overdue then are only charged from this
 * moment, so it is set once by the migration and never listed or edited through the API.
 */
const RETURN_RULES_EFFECTIVE_AT = 'contract.return_rules_effective_at';
const HIDDEN_KEYS = [RETURN_RULES_EFFECTIVE_AT];

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

  async getBookingDefaultRentalMonths(): Promise<number> {
    return this.getNumber('booking.default_rental_months');
  }

  /** System-wide rental term packages, ascending; warehouses without their own follow these. */
  async getBookingRentalMonthsOptions(): Promise<number[]> {
    const value = await this.get('booking.rental_months_options');
    return Array.isArray(value) ? sortRentalTerms(value) : [];
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

  async getCheckInQrTtlMinutes(): Promise<number> {
    return this.getNumber('access.check_in_qr_ttl_minutes');
  }

  /** Notice (days) a customer must give to return early without losing a month of rent. */
  async getReturnNoticeDays(): Promise<number> {
    return this.getNumber('contract.return_notice_days');
  }

  /** Per-day overstay charge as a percentage of one day's rent (monthly rent / 30). */
  async getOverduePenaltyPercent(): Promise<number> {
    return this.getNumber('billing.overdue_penalty_percent');
  }

  /** Days past term end before a manager is nudged about a possibly abandoned unit. */
  async getAbandonedAfterDays(): Promise<number> {
    return this.getNumber('contract.abandoned_after_days');
  }

  /** Days past the contracted start before a manager is nudged about a no-show DRAFT. */
  async getNoShowAfterDays(): Promise<number> {
    return this.getNumber('contract.no_show_after_days');
  }

  /**
   * Days from today a unit-change move may land on. Each bound is validated on its own, so a
   * minimum notice above the horizon is met by stretching the horizon — a day stays bookable.
   */
  async getUnitChangeMoveWindow(): Promise<ClientUnitChangeSettings> {
    const [minLeadDays, maxDaysAhead] = await Promise.all([
      this.getNumber('contract.unit_change_min_lead_days'),
      this.getNumber('contract.unit_change_max_days_ahead'),
    ]);
    return { minLeadDays, maxDaysAhead: Math.max(maxDaysAhead, minLeadDays) };
  }

  /** Furthest day ahead (Vietnam days from today) a return can be booked or rescheduled. */
  async getReturnMaxDaysAhead(): Promise<number> {
    return this.getNumber('contract.return_max_days_ahead');
  }

  /** Share (%) of the deposit an early return forfeits; captured on each return request. */
  async getEarlyReturnForfeitPercent(): Promise<number> {
    return this.getNumber('contract.early_return_forfeit_percent');
  }

  /** Days after a booking item is created during which its contract may be created. */
  async getContractCreationWindowDays(): Promise<number> {
    return this.getNumber('contract.creation_window_days');
  }

  /** Cap (days from approval) on when a unit-change deposit top-up falls due. */
  async getUnitChangeTopUpDueDays(): Promise<number> {
    return this.getNumber('contract.unit_change_top_up_due_days');
  }

  /** Days past the booked move day before a unit change awaiting its top-up is auto-cancelled. */
  async getUnitChangeMoveOverdueDays(): Promise<number> {
    return this.getNumber('contract.unit_change_move_overdue_days');
  }

  /** Which overdue days remind the customer, and from when (and how often) managers hear of it. */
  async getOverdueReminderSchedule(): Promise<OverdueReminderSchedule> {
    const [customerDays, repeatDays, managerFromDays] = await Promise.all([
      this.get('billing.overdue_reminder_days'),
      this.getNumber('billing.overdue_reminder_repeat_days'),
      this.getNumber('billing.overdue_manager_alert_from_days'),
    ]);
    return {
      customerDays: Array.isArray(customerDays) ? customerDays.map(Number) : [],
      repeatDays,
      managerFromDays,
    };
  }

  /** Furthest day ahead a shelf drop-off or pick-up may be requested. */
  async getShelfRequestMaxDaysAhead(): Promise<number> {
    return this.getNumber('shelf.request_max_days_ahead');
  }

  /** Minutes before a shift starts that its check-in opens. */
  async getCheckInOpensBeforeMinutes(): Promise<number> {
    return this.getNumber('staff.check_in_opens_before_minutes');
  }

  /** Go-live of the return rules; a missing or unreadable value is an error, never a guess. */
  async getReturnRulesEffectiveAt(): Promise<Date> {
    const value = await this.get(RETURN_RULES_EFFECTIVE_AT);
    const at = typeof value === 'string' ? new Date(value) : null;
    if (!at || Number.isNaN(at.getTime())) {
      throw new DomainException(
        ErrorCode.INTERNAL_ERROR,
        `System setting '${RETURN_RULES_EFFECTIVE_AT}' is not a timestamp`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return at;
  }

  /** A unit's own deposit level wins; units without one follow the system-wide setting. */
  async getDepositMonthsFor(unit: Pick<StorageUnit, 'depositMonths'>): Promise<number> {
    return unit.depositMonths ?? this.getDepositDefaultMonths();
  }

  /** The only terms a unit may be booked or renewed for; see `rentalTermsFor`. */
  async getRentalTermsFor(unit: Parameters<typeof rentalTermsFor>[0]): Promise<number[]> {
    return rentalTermsFor(unit, await this.getBookingRentalMonthsOptions());
  }

  /** The subset of settings clients need to drive their own UI — safe to expose to any user. */
  async getClientSettings(): Promise<ClientSettingsResponse> {
    return loadClientSettings(this);
  }

  /** Lists every editable setting with its stored metadata (label, bounds, default). */
  async getAll(): Promise<SystemSettingsResponse> {
    const rows = await this.settingsRepo.find({
      where: { key: Not(In(HIDDEN_KEYS)) },
      order: { group: 'ASC', key: 'ASC' },
    });
    return { settings: rows.map(toSystemSettingRecord) };
  }

  /** Validates each value against the row's stored type/bounds and applies a partial update. */
  async update(values: Record<string, unknown>, admin: AuthUser): Promise<UpdateSettingsResponse> {
    const entries = Object.entries(values);
    if (entries.length === 0) {
      throw fieldValidationError('values', 'isEmpty', 'At least one setting is required to update');
    }

    const keys = entries.map(([key]) => key);
    const rows = await this.settingsRepo.find({ where: { key: In(keys) } });
    // Hidden keys answer like unknown ones: they are not part of the editable settings.
    const byKey = new Map(
      rows.filter((row) => !HIDDEN_KEYS.includes(row.key)).map((row) => [row.key, row]),
    );

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
