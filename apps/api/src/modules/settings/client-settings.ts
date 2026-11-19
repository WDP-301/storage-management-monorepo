import type { ClientBookingSettings, ClientSettingsResponse } from '@storage/types';
import type { SettingsService } from './settings.service';

/** Reads every setting a client needs in one go; see `toClientBookingSettings` for the booking rules. */
export async function loadClientSettings(
  settings: SettingsService,
): Promise<ClientSettingsResponse> {
  const [
    rentalMonthsOptions,
    defaultRentalMonths,
    minRentalMonths,
    maxRentalMonths,
    leadDays,
    maxUnitsPerBooking,
    noticeDays,
    overduePenaltyPercent,
    returnMaxDaysAhead,
    earlyForfeitPercent,
    unitChange,
    shelfRequestMaxDaysAhead,
  ] = await Promise.all([
    settings.getBookingRentalMonthsOptions(),
    settings.getBookingDefaultRentalMonths(),
    settings.getBookingMinRentalMonths(),
    settings.getBookingMaxRentalMonths(),
    settings.getBookingLeadDays(),
    settings.getBookingMaxUnitsPerBooking(),
    settings.getReturnNoticeDays(),
    settings.getOverduePenaltyPercent(),
    settings.getReturnMaxDaysAhead(),
    settings.getEarlyReturnForfeitPercent(),
    settings.getUnitChangeMoveWindow(),
    settings.getShelfRequestMaxDaysAhead(),
  ]);
  return {
    booking: toClientBookingSettings({
      rentalMonthsOptions,
      defaultRentalMonths,
      minRentalMonths,
      maxRentalMonths,
      leadDays,
      maxUnitsPerBooking,
    }),
    return: {
      noticeDays,
      overduePenaltyPercent,
      maxDaysAhead: returnMaxDaysAhead,
      earlyForfeitPercent,
    },
    unitChange,
    shelf: { requestMaxDaysAhead: shelfRequestMaxDaysAhead },
  };
}

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
