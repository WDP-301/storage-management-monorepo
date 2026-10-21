import { InvoiceKind, InvoiceStatus } from '@storage/types';
import { voidUnstartedInvoices } from './unstarted-invoices.util';

interface Row {
  id: string;
  invoice_no: string;
  contract_id: string;
  kind: InvoiceKind;
  status: InvoiceStatus;
  start_at: Date | null;
}

/** Applies the UPDATE the way PostgreSQL would, from the parameters it was sent. */
function fakeEm(rows: Row[]) {
  const query = jest.fn(async (sql: string, params: unknown[]) => {
    expect(sql).toContain('contract_id = $1');
    expect(sql).toContain('kind <> $4');
    expect(sql).toContain('status <> $3');
    expect(sql).toContain('start_at >= $2');
    const [contractId, from, voidStatus, settlementKind] = params as [string, Date, string, string];
    const hit = rows.filter(
      (r) =>
        r.contract_id === contractId &&
        r.kind !== settlementKind &&
        r.status !== voidStatus &&
        r.start_at !== null &&
        r.start_at.getTime() >= from.getTime(),
    );
    for (const row of hit) row.status = voidStatus as InvoiceStatus;
    return [hit.map((r) => ({ id: r.id, invoiceNo: r.invoice_no })), hit.length];
  });
  return { query };
}

const invoice = (id: string, startAt: string | null, over: Partial<Row> = {}): Row => ({
  id,
  invoice_no: `INV-${id}`,
  contract_id: 'contract-1',
  kind: InvoiceKind.INITIAL,
  status: InvoiceStatus.ISSUED,
  start_at: startAt ? new Date(startAt) : null,
  ...over,
});

describe('voidUnstartedInvoices', () => {
  it('voids periods starting on or after the return day, paid or not, and keeps the running one', async () => {
    const rows = [
      // Running on the return day (started 01/04 in Vietnam).
      invoice('running', '2027-03-31T17:00:00.000Z', { status: InvoiceStatus.PAID }),
      // Starts at 00:00 on the return day in Vietnam.
      invoice('same-day', '2027-04-19T17:00:00.000Z'),
      invoice('later-paid', '2027-05-19T17:00:00.000Z', { status: InvoiceStatus.PAID }),
    ];
    const em = fakeEm(rows);

    await expect(voidUnstartedInvoices(em as never, 'contract-1', '2027-04-20')).resolves.toEqual([
      { id: 'same-day', invoiceNo: 'INV-same-day' },
      { id: 'later-paid', invoiceNo: 'INV-later-paid' },
    ]);
    expect(em.query.mock.calls[0][1]).toEqual([
      'contract-1',
      new Date('2027-04-19T17:00:00.000Z'),
      InvoiceStatus.VOID,
      InvoiceKind.SETTLEMENT,
    ]);
    expect(rows.map((r) => r.status)).toEqual([
      InvoiceStatus.PAID,
      InvoiceStatus.VOID,
      InvoiceStatus.VOID,
    ]);
  });

  it('leaves settlement invoices, voided invoices and other contracts alone', async () => {
    const rows = [
      invoice('settlement', '2027-05-01T00:00:00.000Z', { kind: InvoiceKind.SETTLEMENT }),
      invoice('already-void', '2027-05-01T00:00:00.000Z', { status: InvoiceStatus.VOID }),
      invoice('other', '2027-05-01T00:00:00.000Z', { contract_id: 'contract-2' }),
      invoice('undated', null),
    ];

    await expect(
      voidUnstartedInvoices(fakeEm(rows) as never, 'contract-1', '2027-04-20'),
    ).resolves.toEqual([]);
    expect(rows.map((r) => r.status)).toEqual([
      InvoiceStatus.ISSUED,
      InvoiceStatus.VOID,
      InvoiceStatus.ISSUED,
      InvoiceStatus.ISSUED,
    ]);
  });
});
