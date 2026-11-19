import type { ClientBookingSettings } from '@storage/types';
import { toClientBookingSettings } from './client-settings';

const base: ClientBookingSettings = {
  rentalMonthsOptions: [3, 6, 12],
  defaultRentalMonths: 6,
  leadDays: 30,
  maxUnitsPerBooking: 4,
};

describe('toClientBookingSettings', () => {
  it('passes the packages and a default among them through unchanged', () => {
    expect(toClientBookingSettings(base)).toEqual(base);
  });

  it('offers exactly the configured packages, even below the old minimum term', () => {
    const result = toClientBookingSettings({ ...base, rentalMonthsOptions: [1, 3] });

    expect(result.rentalMonthsOptions).toEqual([1, 3]);
  });

  it('pre-selects the shortest package when the default is not one of them', () => {
    const result = toClientBookingSettings({ ...base, defaultRentalMonths: 8 });

    expect(result.rentalMonthsOptions).toEqual([3, 6, 12]);
    expect(result.defaultRentalMonths).toBe(3);
  });
});
