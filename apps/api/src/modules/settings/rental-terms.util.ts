import type { StorageUnit } from '@entities/storage-unit.entity';
import { StorageUnitKind } from '@storage/types';

/** Ascending and without repeats, the order every client shows the packages in. */
export const sortRentalTerms = (months: readonly number[]): number[] =>
  [...new Set(months.map(Number))].sort((a, b) => a - b);

type RentalTermsUnit = Pick<StorageUnit, 'kind' | 'rentalMonthsOptions'> & {
  parent?: Pick<StorageUnit, 'rentalMonthsOptions'> | null;
};

/**
 * The terms a unit can be booked or renewed for: its own packages, a shelf its shelf warehouse's
 * (`parent` must be loaded for a shelf), otherwise the system-wide list.
 */
export function rentalTermsFor(unit: RentalTermsUnit, systemTerms: readonly number[]): number[] {
  const own =
    unit.kind === StorageUnitKind.SHELF
      ? unit.parent?.rentalMonthsOptions
      : unit.rentalMonthsOptions;
  return sortRentalTerms(own?.length ? own : systemTerms);
}
