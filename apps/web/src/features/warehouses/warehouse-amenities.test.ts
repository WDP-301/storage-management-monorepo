import { describe, expect, it } from 'vitest';
import type { Amenity, WarehouseAmenity } from '../../types/amenity';
import {
  type AmenityRow,
  amenityKey,
  availableOptions,
  isInactiveRow,
  toAmenityInputs,
  toAmenityRows,
  validateAmenityRows,
} from './warehouse-amenities';

const amenity = (id: string, name = id): Amenity => ({
  id,
  code: id.toUpperCase(),
  name,
  description: null,
  isActive: true,
  sortOrder: 0,
});
const row = (amenityId: string, quantity = '1', note = ''): AmenityRow => ({
  amenityId,
  name: amenityId,
  quantity,
  note,
});

describe('warehouse amenities helpers', () => {
  it('offers only active amenities that are not already selected', () => {
    const active = [amenity('a'), amenity('b'), amenity('c')];
    expect(availableOptions(active, [row('b')]).map((a) => a.id)).toEqual(['a', 'c']);
  });

  it('flags a row whose amenity left the active catalog', () => {
    expect(isInactiveRow(row('old'), [amenity('a')])).toBe(true);
    expect(isInactiveRow(row('a'), [amenity('a')])).toBe(false);
  });

  it('builds a key that ignores row order but sees quantity and note changes', () => {
    expect(amenityKey([row('a', '2'), row('b')])).toBe(amenityKey([row('b'), row('a', '2')]));
    expect(amenityKey([row('a', '2')])).not.toBe(amenityKey([row('a', '3')]));
    expect(amenityKey([row('a', '2')])).not.toBe(amenityKey([row('a', '2', 'mới')]));
    expect(amenityKey([row('a', '2', '  ')])).toBe(amenityKey([row('a', '2')]));
  });

  it('sends an empty or blank note as null and trims the rest', () => {
    expect(toAmenityInputs([row('a', '2', '  '), row('b', '1', ' cạnh cửa ')])).toEqual([
      { amenityId: 'a', quantity: 2, note: null },
      { amenityId: 'b', quantity: 1, note: 'cạnh cửa' },
    ]);
  });

  it('maps stored amenities to string rows', () => {
    const stored: WarehouseAmenity[] = [
      { amenityId: 'a', code: 'A', name: 'A', quantity: 3, note: null },
    ];
    expect(toAmenityRows(stored)).toEqual([{ amenityId: 'a', name: 'A', quantity: '3', note: '' }]);
    expect(toAmenityRows(undefined)).toEqual([]);
  });

  it('rejects quantities outside 1-99 or not whole, and over-long notes', () => {
    expect(validateAmenityRows([row('a', '1'), row('b', '99')])).toBeNull();
    for (const bad of ['0', '100', '1.5', '', 'abc']) {
      expect(validateAmenityRows([row('a', bad)])).not.toBeNull();
    }
    expect(validateAmenityRows([row('a', '1', 'x'.repeat(256))])).not.toBeNull();
  });

  it('rejects more than 30 amenities', () => {
    const rows = Array.from({ length: 31 }, (_, i) => row(`a${i}`));
    expect(validateAmenityRows(rows)).not.toBeNull();
  });
});
