import type { ClientBookingSettings } from '@storage/types';

/**
 * Settings are validated one key at a time, so an admin can leave them mutually inconsistent
 * (e.g. raise the minimum term above a suggested option). Clients get options that the booking
 * endpoint will actually accept, and a default that is one of them. A default that is in range but
 * missing from the suggestions is added to them rather than dropped — the admin chose it explicitly.
 */
export function toClientBookingSettings(raw: ClientBookingSettings): ClientBookingSettings {
  const { minRentalMonths, maxRentalMonths, defaultRentalMonths } = raw;
  const inRange = (months: number) => months >= minRentalMonths && months <= maxRentalMonths;

  const candidates = [...raw.rentalMonthsOptions, defaultRentalMonths].filter(inRange);
  const valid = [...new Set(candidates)].sort((a, b) => a - b);
  const rentalMonthsOptions = valid.length > 0 ? valid : [minRentalMonths];

  return {
    ...raw,
    rentalMonthsOptions,
    defaultRentalMonths: inRange(defaultRentalMonths)
      ? defaultRentalMonths
      : rentalMonthsOptions[0],
  };
}
