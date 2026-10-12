import { extractInvoiceNos, generateInvoiceNo } from './invoice-no.util';

describe('invoice numbers', () => {
  it('generates numbers its own parser reads back', () => {
    const invoiceNo = generateInvoiceNo();

    expect(invoiceNo).toMatch(/^INV-\d{13}-[0-9A-F]{4}$/);
    expect(extractInvoiceNos(invoiceNo)).toEqual([invoiceNo]);
  });

  it('reads numbers whose separators the bank stripped or replaced', () => {
    expect(extractInvoiceNos('MBVCB.123 INV17907608046096618 chuyen tien')).toEqual([
      'INV-1790760804609-6618',
    ]);
    expect(extractInvoiceNos('inv 1790760804609 a3f2')).toEqual(['INV-1790760804609-A3F2']);
    expect(extractInvoiceNos('INV.1790760804609.6618 INV-1790760804609-6618')).toEqual([
      'INV-1790760804609-6618',
    ]);
  });

  it('ignores booking numbers and empty content', () => {
    expect(extractInvoiceNos('BK-1790760804609-6618')).toEqual([]);
    expect(extractInvoiceNos(null)).toEqual([]);
  });
});
