export type SettingValueType =
  | 'int'
  | 'float'
  | 'string'
  | 'boolean'
  | 'duration_minutes'
  | 'int_list';

export interface SettingDefinition {
  type: SettingValueType;
  default: unknown;
  /** Inclusive lower bound for numeric types. */
  min?: number;
  /** Inclusive upper bound for numeric types. */
  max?: number;
  group: string;
  label: string;
  description: string;
}

/**
 * Single source of truth for every admin-configurable system setting.
 *
 * - `default` is upserted into `system_settings` on application bootstrap
 *   (see `SettingsService.onApplicationBootstrap`), so adding a key here does
 *   not require a new migration.
 * - `min`/`max` are enforced on admin update AND must stay compatible with
 *   hard DB constraints (e.g. `booking.max_rental_months` cannot exceed the
 *   `rental_months <= 60` CHECK on `booking_items`).
 */
export const SETTINGS_REGISTRY: Record<string, SettingDefinition> = {
  'booking.hold_minutes': {
    type: 'int',
    default: 15,
    min: 1,
    max: 1440,
    group: 'booking',
    label: 'Booking hold time (minutes)',
    description:
      'How long selected units stay HELD for a booking before the cron job automatically releases them.',
  },
  'booking.lead_days': {
    type: 'int',
    default: 30,
    min: 1,
    max: 365,
    group: 'booking',
    label: 'Max lead days',
    description:
      'The rental start date (requested_start_at) cannot be further in the future than this many days.',
  },
  'booking.min_rental_months': {
    type: 'int',
    default: 6,
    min: 1,
    max: 60,
    group: 'booking',
    label: 'Minimum rental term (months)',
    description: 'Bookings with rentalMonths below this value are rejected.',
  },
  'booking.max_rental_months': {
    type: 'int',
    default: 60,
    min: 1,
    max: 60,
    group: 'booking',
    label: 'Maximum rental term (months)',
    description:
      'Bookings with rentalMonths above this value are rejected. Cannot exceed 60 due to a DB CHECK constraint.',
  },
  'booking.default_rental_months': {
    type: 'int',
    default: 6,
    min: 1,
    max: 60,
    group: 'booking',
    label: 'Default rental term (months)',
    description:
      'Default value for clients (UI) when the user does not explicitly pick a rental term.',
  },
  'booking.rental_months_options': {
    type: 'int_list',
    default: [6, 12, 18],
    min: 1,
    max: 60,
    group: 'booking',
    label: 'Suggested rental terms (months)',
    description:
      'List of terms offered to customers in the UI. Display-only suggestion, not a hard limit.',
  },
  'booking.max_units_per_booking': {
    type: 'int',
    default: 4,
    min: 1,
    max: 20,
    group: 'booking',
    label: 'Max units per booking',
    description:
      'Limits the number of storage units in one booking so a single customer cannot occupy too many units at once.',
  },
  'idempotency.ttl_hours': {
    type: 'int',
    default: 24,
    min: 1,
    max: 720,
    group: 'idempotency',
    label: 'Idempotency key TTL (hours)',
    description:
      'How long an idempotency key is kept to guard against duplicate retries before the cron job removes it.',
  },
  'idempotency.stale_seconds': {
    type: 'int',
    default: 60,
    min: 10,
    max: 3600,
    group: 'idempotency',
    label: 'Stale PROCESSING key threshold (seconds)',
    description:
      'A key stuck in PROCESSING beyond this threshold (e.g. after a server crash) can be reclaimed by another request.',
  },
  'deposit.default_months': {
    type: 'float',
    default: 1,
    min: 0,
    max: 12,
    group: 'deposit',
    label: 'Default deposit months',
    description:
      'System-wide deposit level used when a unit type has no value of its own (unit_types.default_deposit_months).',
  },
} as const;

export type SettingKey = keyof typeof SETTINGS_REGISTRY;

/**
 * Validates a candidate value for a setting key against its registry definition.
 * Returns an error message, or `null` when the value is valid.
 */
export function validateSettingValue(key: string, value: unknown): string | null {
  const def = SETTINGS_REGISTRY[key];
  if (!def) {
    return 'Unknown setting key';
  }

  switch (def.type) {
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
      if (def.min !== undefined && value.some((v) => v < def.min)) {
        return `Each item must be >= ${def.min}`;
      }
      if (def.max !== undefined && value.some((v) => v > def.max)) {
        return `Each item must be <= ${def.max}`;
      }
      break;
  }

  if (def.type !== 'string' && def.type !== 'boolean' && def.type !== 'int_list') {
    const numeric = value as number;
    if (def.min !== undefined && numeric < def.min) {
      return `Value must be >= ${def.min}`;
    }
    if (def.max !== undefined && numeric > def.max) {
      return `Value must be <= ${def.max}`;
    }
  }

  return null;
}
