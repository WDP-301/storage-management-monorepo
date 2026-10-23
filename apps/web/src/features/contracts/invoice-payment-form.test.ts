import { describe, expect, it } from 'vitest';
import {
  buildPaymentInput,
  initialPaymentForm,
  parseVndAmount,
  validatePaymentForm,
} from './invoice-payment-form';

const TODAY = '2026-10-22';
const PROOF = { fileKey: 'uploads/1-proof.jpg', name: 'proof.jpg', mimeType: 'image/jpeg' };
const form = (over: Partial<ReturnType<typeof initialPaymentForm>> = {}) => ({
  ...initialPaymentForm(1_500_000, TODAY),
  note: 'Khách ghi sai nội dung',
  ...over,
});

describe('parseVndAmount', () => {
  it('reads plain and dotted thousands', () => {
    expect(parseVndAmount('1500000')).toBe(1_500_000);
    expect(parseVndAmount('1.500.000')).toBe(1_500_000);
    expect(parseVndAmount(' 1,500,000 ')).toBe(1_500_000);
  });

  it('rejects zero, negatives, decimals and text', () => {
    for (const raw of ['0', '-5', '12.5k', 'abc', '']) expect(parseVndAmount(raw)).toBeNull();
  });
});

describe('validatePaymentForm', () => {
  it('accepts a transfer with its bank reference', () => {
    expect(validatePaymentForm(form({ transferRef: 'FT123' }), 1_500_000, TODAY)).toBeNull();
  });

  it('accepts a transfer proven only by a photo', () => {
    expect(validatePaymentForm(form({ evidence: [PROOF] }), 1_500_000, TODAY)).toBeNull();
  });

  it('needs a reference or a photo for a transfer, but not for cash', () => {
    expect(validatePaymentForm(form(), 1_500_000, TODAY)).toMatch(/mã giao dịch/);
    expect(validatePaymentForm(form({ method: 'CASH' }), 1_500_000, TODAY)).toBeNull();
  });

  it('refuses more than is due, a future day and a missing note', () => {
    const cash = { method: 'CASH' as const };
    expect(validatePaymentForm(form({ ...cash, amount: '1500001' }), 1_500_000, TODAY)).toMatch(
      /vượt quá/,
    );
    expect(validatePaymentForm(form({ ...cash, paidOn: '2026-10-23' }), 1_500_000, TODAY)).toMatch(
      /tương lai/,
    );
    expect(validatePaymentForm(form({ ...cash, note: '  ' }), 1_500_000, TODAY)).toMatch(/ghi chú/);
  });
});

describe('buildPaymentInput', () => {
  it('sends today as "now" and trims the text fields', () => {
    expect(
      buildPaymentInput(form({ transferRef: ' FT123 ', note: ' Sai nội dung ' }), TODAY),
    ).toEqual({
      method: 'BANK_TRANSFER',
      amount: 1_500_000,
      transferRef: 'FT123',
      note: 'Sai nội dung',
    });
  });

  it('pins an earlier day to noon in Vietnam and keeps the proof', () => {
    const input = buildPaymentInput(
      form({ method: 'CASH', paidOn: '2026-10-20', evidence: [PROOF] }),
      TODAY,
    );
    expect(input.paidAt).toBe('2026-10-20T05:00:00.000Z');
    expect(input.evidence).toEqual([PROOF]);
    expect(input.transferRef).toBeUndefined();
  });
});

describe('isStalePaymentError', () => {
  it('treats a conflict and an amount above what is now due as stale', async () => {
    const { isStalePaymentError } = await import('./invoice-display');
    expect(isStalePaymentError({ status: 409 })).toBe(true);
    expect(
      isStalePaymentError({
        status: 400,
        details: { fields: [{ field: 'amount', code: 'exceedsDue' }] },
      }),
    ).toBe(true);
    expect(
      isStalePaymentError({ status: 400, details: { fields: [{ field: 'note', code: 'x' }] } }),
    ).toBe(false);
  });
});
