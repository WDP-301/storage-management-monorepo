import { withVat } from './rent-invoice-amounts.util';

describe('withVat', () => {
  it('adds nothing at 0%', () => {
    expect(withVat(1500000, 0)).toEqual({ subtotal: 1500000, taxAmount: 0, total: 1500000 });
  });

  it('rounds the tax half up to the dong', () => {
    expect(withVat('1234567.00', 10)).toEqual({
      subtotal: 1234567,
      taxAmount: 123457,
      total: 1358024,
    });
    expect(withVat(1005, 8)).toEqual({ subtotal: 1005, taxAmount: 80, total: 1085 });
  });
});
