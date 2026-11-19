import type { ClientBookingSettings, ClientSettingsResponse } from '@storage/types';
import type { SettingsService } from './settings.service';

/** Reads every setting a client needs in one go; see `toClientBookingSettings` for the booking rules. */
export async function loadClientSettings(
  settings: SettingsService,
): Promise<ClientSettingsResponse> {
  const [
    rentalMonthsOptions,
    defaultRentalMonths,
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
 * The default term is set apart from the packages, so it may not be one of them; the client then
 * pre-selects the shortest package instead of offering a term the booking endpoint would refuse.
 */
export function toClientBookingSettings(raw: ClientBookingSettings): ClientBookingSettings {
  const { rentalMonthsOptions, defaultRentalMonths } = raw;
  return {
    ...raw,
    defaultRentalMonths: rentalMonthsOptions.includes(defaultRentalMonths)
      ? defaultRentalMonths
      : rentalMonthsOptions[0],
  };
}
