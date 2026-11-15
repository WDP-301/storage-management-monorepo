import { describe, expect, it } from 'vitest';
import {
  buildReceiptQuery,
  describeVoidError,
  EMPTY_RECEIPT_FILTERS,
  summarizeLines,
  totalLabel,
} from './shelf-records-display';

const apiError = (props: object) => Object.assign(new Error('server text'), props);

describe('totalLabel', () => {
  it('adds up one unit and counts kinds when units differ', () => {
    expect(
      totalLabel([
        { quantity: 2, unit: 'BOX' },
        { quantity: 3, unit: 'BOX' },
      ]),
    ).toBe('5 thùng');
    expect(
      totalLabel([
        { quantity: 2, unit: 'BOX' },
        { quantity: 3, unit: 'PIECE' },
      ]),
    ).toBe('2 loại');
    expect(totalLabel([])).toBe('0');
  });
});

describe('summarizeLines', () => {
  const line = (name: string, quantity: number) => ({ name, quantity, unit: 'BOX' as const });
  it('lists up to three lines then counts the rest', () => {
    expect(summarizeLines([line('A', 1), line('B', 2)])).toBe('A ×1 thùng, B ×2 thùng');
    expect(summarizeLines([line('A', 1), line('B', 2), line('C', 3), line('D', 4)])).toBe(
      'A ×1 thùng, B ×2 thùng, C ×3 thùng và 1 món khác',
    );
    expect(summarizeLines([])).toBe('—');
  });
});

describe('buildReceiptQuery', () => {
  it('sends no status by default and trims search', () => {
    expect(buildReceiptQuery({ ...EMPTY_RECEIPT_FILTERS, search: '  PG-1 ' }, 2)).toEqual({
      page: 2,
      limit: 20,
      search: 'PG-1',
    });
  });
  it('maps the toggles to status and disputed', () => {
    expect(
      buildReceiptQuery(
        { ...EMPTY_RECEIPT_FILTERS, includeVoided: false, disputedOnly: true, type: 'PICK_UP' },
        1,
      ),
    ).toEqual({ page: 1, limit: 20, type: 'PICK_UP', status: 'ACTIVE', disputed: true });
  });
});

describe('describeVoidError', () => {
  it('lists the short items', () => {
    const msg = describeVoidError(
      apiError({
        code: 'SHELF_STOCK_INSUFFICIENT',
        details: { items: [{ name: 'Thùng sách', requested: 5, available: 2 }] },
      }),
    );
    expect(msg).toContain('Thùng sách: còn 2, cần 5');
  });
  it('maps conflicts, contract state and scope', () => {
    expect(
      describeVoidError(apiError({ code: 'CONFLICT', details: { reason: 'ALREADY_VOIDED' } })),
    ).toMatch(/đã được hủy/);
    expect(
      describeVoidError(
        apiError({ code: 'SHELF_RECEIPT_NOT_ALLOWED', details: { reason: 'CONTRACT_NOT_ACTIVE' } }),
      ),
    ).toMatch(/không còn hiệu lực/);
    expect(describeVoidError(apiError({ status: 403 }))).toBe('Bạn không quản lý cơ sở này.');
    expect(describeVoidError(apiError({}))).toBe('server text');
  });
});
