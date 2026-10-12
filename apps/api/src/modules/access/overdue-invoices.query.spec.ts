import { findOverdueInvoiceNos } from './overdue-invoices.query';

describe('findOverdueInvoiceNos', () => {
  it('returns invoice numbers and filters in SQL', async () => {
    const em = {
      query: jest.fn().mockResolvedValue([{ invoiceNo: 'INV-1' }, { invoiceNo: 'INV-2' }]),
    };
    const now = new Date('2026-03-01T00:00:00Z');

    await expect(findOverdueInvoiceNos(em as never, 'cust-1', now)).resolves.toEqual([
      'INV-1',
      'INV-2',
    ]);

    const [sql, params] = em.query.mock.calls[0];
    expect(params).toEqual(['cust-1', now]);
    expect(sql).toContain(`"status" IN ('ISSUED', 'PARTIALLY_PAID')`);
    // Invoices of cancelled/deleted contracts are ignored; contract-less invoices still count.
    expect(sql).toContain(
      `"contract_id" IS NULL OR (c."status" <> 'CANCELLED' AND c."deleted_at" IS NULL)`,
    );
  });
});
