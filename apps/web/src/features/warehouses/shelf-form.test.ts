import { describe, expect, it } from 'vitest';
import { EMPTY_BULK_SHELF_FORM, nextShelfNumber, withNextBulkRange } from './shelf-form';

const shelves = [
  { code: 'KK1-A-01' },
  { code: 'KK1-A-07' },
  { code: 'KK1-B-02' },
  { code: 'KK1-A-EXTRA' },
  { code: 'OTHER-A-50' },
];

describe('nextShelfNumber', () => {
  it('continues after the highest number of the same building and prefix', () => {
    expect(nextShelfNumber(shelves, 'KK1', 'A')).toBe(8);
    expect(nextShelfNumber(shelves, 'KK1', 'b')).toBe(3);
  });

  it('starts at 1 for an unused prefix or an empty building', () => {
    expect(nextShelfNumber(shelves, 'KK1', 'C')).toBe(1);
    expect(nextShelfNumber([], 'KK1', 'A')).toBe(1);
  });

  it('treats regex characters in codes literally', () => {
    expect(nextShelfNumber([{ code: 'K.1-A-04' }], 'K.1', 'A')).toBe(5);
    expect(nextShelfNumber([{ code: 'KX1-A-04' }], 'K.1', 'A')).toBe(1);
  });
});

describe('withNextBulkRange', () => {
  it('moves the range to the next free number and keeps its size', () => {
    expect(withNextBulkRange(EMPTY_BULK_SHELF_FORM, shelves, 'KK1')).toMatchObject({
      from: '8',
      to: '17',
    });
  });

  it('falls back to a single shelf when the current range is unreadable', () => {
    const form = { ...EMPTY_BULK_SHELF_FORM, prefix: 'C', from: '', to: '' };
    expect(withNextBulkRange(form, shelves, 'KK1')).toMatchObject({ from: '1', to: '1' });
  });
});
