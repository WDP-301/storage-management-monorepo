import type { UnitOffer } from '../../types/customer';

/** Totals a money field across a set of units (rent or deposit). */
export function sumUnitPrices(
  units: readonly UnitOffer[],
  key: 'monthlyPrice' | 'deposit',
): number {
  return units.reduce((total, unit) => total + unit[key], 0);
}
