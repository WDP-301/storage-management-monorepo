import { StorageUnitKind } from '@storage/types';
import { rentalTermsFor, sortRentalTerms } from './rental-terms.util';

const system = [6, 12, 18];

describe('rentalTermsFor', () => {
  it('uses the warehouse own packages, sorted', () => {
    const unit = { kind: StorageUnitKind.SELF_STORAGE, rentalMonthsOptions: [12, 3] };

    expect(rentalTermsFor(unit, system)).toEqual([3, 12]);
  });

  it('follows the system-wide packages when the warehouse has none', () => {
    const unit = { kind: StorageUnitKind.SELF_STORAGE, rentalMonthsOptions: null };

    expect(rentalTermsFor(unit, system)).toEqual(system);
  });

  it('gives a shelf its shelf warehouse packages, ignoring any of its own', () => {
    const shelf = {
      kind: StorageUnitKind.SHELF,
      rentalMonthsOptions: [24],
      parent: { rentalMonthsOptions: [1, 2] },
    };

    expect(rentalTermsFor(shelf, system)).toEqual([1, 2]);
  });

  it('gives a shelf the system-wide packages when its shelf warehouse has none', () => {
    const shelf = { kind: StorageUnitKind.SHELF, rentalMonthsOptions: null, parent: null };

    expect(rentalTermsFor(shelf, system)).toEqual(system);
  });
});

describe('sortRentalTerms', () => {
  it('sorts ascending and drops repeats', () => {
    expect(sortRentalTerms([18, 6, 12, 6])).toEqual([6, 12, 18]);
  });
});
