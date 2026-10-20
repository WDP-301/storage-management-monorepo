import type { ClientBookingSettings } from '@storage/types';
import { toClientBookingSettings } from './client-settings';

const base: ClientBookingSettings = {
  rentalMonthsOptions: [6, 12, 18],
  defaultRentalMonths: 6,
  minRentalMonths: 6,
  maxRentalMonths: 60,
  leadDays: 30,
  maxUnitsPerBooking: 4,
};

describe('toClientBookingSettings', () => {
  it('passes consistent settings through unchanged', () => {
    expect(toClientBookingSettings(base)).toEqual(base);
  });

  it('sorts and de-duplicates the options', () => {
    const result = toClientBookingSettings({ ...base, rentalMonthsOptions: [18, 6, 12, 6] });

    expect(result.rentalMonthsOptions).toEqual([6, 12, 18]);
  });

  it('adds an in-range default that the admin left out of the options', () => {
    const result = toClientBookingSettings({
      ...base,
      rentalMonthsOptions: [6, 18],
      defaultRentalMonths: 12,
    });

    expect(result.rentalMonthsOptions).toEqual([6, 12, 18]);
    expect(result.defaultRentalMonths).toBe(12);
  });

  it('drops out-of-range options and re-picks an out-of-range default', () => {
    const result = toClientBookingSettings({ ...base, minRentalMonths: 12, maxRentalMonths: 24 });

    expect(result.rentalMonthsOptions).toEqual([12, 18]);
    expect(result.defaultRentalMonths).toBe(12);
  });

  it('keeps an in-range default as the only option when every suggestion is out of range', () => {
    const result = toClientBookingSettings({
      ...base,
      rentalMonthsOptions: [6, 12],
      defaultRentalMonths: 24,
      minRentalMonths: 24,
    });

    expect(result.rentalMonthsOptions).toEqual([24]);
    expect(result.defaultRentalMonths).toBe(24);
  });

  it('falls back to the minimum term when neither options nor default are in range', () => {
    const result = toClientBookingSettings({
      ...base,
      rentalMonthsOptions: [],
      minRentalMonths: 9,
    });

    expect(result.rentalMonthsOptions).toEqual([9]);
    expect(result.defaultRentalMonths).toBe(9);
  });
});
