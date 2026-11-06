import { buildCounterPanel } from './counter-panel.query';

const NOW = new Date('2026-11-07T05:00:00Z');
const session = {
  id: 'ses-1',
  customerId: 'u-1',
  warehouseId: 'w-1',
  facilityId: 'f-1',
  startedAt: new Date('2026-11-07T04:50:00Z'),
  expiresAt: new Date('2026-11-07T05:20:00Z'),
};
const place = {
  warehouseId: 'w-1',
  warehouseCode: 'W-1',
  warehouseName: 'Kho 1',
  facilityId: 'f-1',
  facilityCode: 'F-1',
  facilityName: 'CN 1',
  customerId: 'u-1',
  customerName: 'An',
  customerPhone: '0900',
};
const contract = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  contractNo: `HD-${id}`,
  status: 'ACTIVE',
  customerId: 'u-1',
  effectiveAt: new Date('2026-01-01T00:00:00Z'),
  shelfId: `s-${id}`,
  shelfCode: `K-${id}`,
  shelfName: `Kệ ${id}`,
  warehouseId: 'w-1',
  warehouseCode: 'W-1',
  warehouseName: 'Kho 1',
  facilityId: 'f-1',
  facilityCode: 'F-1',
  facilityName: 'CN 1',
  returnOpen: false,
  ...over,
});

interface World {
  contracts: unknown[];
  stock: unknown[];
  overdue: { invoiceNo: string }[];
  receipts: unknown[];
}
const run = async (world: Partial<World>) => {
  const w: World = { contracts: [], stock: [], overdue: [], receipts: [], ...world };
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('CROSS JOIN')) return [place];
    if (sql.includes('FROM "invoices"')) return w.overdue;
    if (sql.includes('FROM "contracts" c')) return w.contracts;
    if (sql.includes('FROM "shelf_items"')) return w.stock;
    if (sql.includes('FROM "pickup_requests"')) return [];
    if (sql.includes('FROM "shelf_receipt_lines"')) return [];
    if (sql.includes('FROM "shelf_receipts" r')) return w.receipts;
    return [];
  });
  const view = await buildCounterPanel({ query } as never, session, NOW);
  return { view, query };
};
const item = (contractId: string, name: string, quantity: number) => ({
  id: `i-${name}`,
  contractId,
  name,
  quantity,
  updatedAt: NOW,
});
const receiptRow = (id: string, contractId: string) => ({
  id,
  code: id,
  type: 'DROP_OFF',
  status: 'ACTIVE',
  contractId,
  contractNo: `HD-${contractId}`,
  shelfId: 's',
  shelfCode: 'K',
  shelfName: 'K',
  warehouseId: 'w-1',
  warehouseCode: 'W-1',
  warehouseName: 'Kho',
  facilityId: 'f-1',
  facilityCode: 'F-1',
  facilityName: 'CN',
  customerId: 'u-1',
  customerName: 'An',
  customerPhone: null,
  performedById: null,
  performedByName: null,
  createdAt: NOW,
  note: null,
  photos: [],
  pickupRequestId: null,
  recovered: false,
  voidedAt: null,
  voidedById: null,
  voidedByName: null,
  voidReason: null,
});

describe('buildCounterPanel', () => {
  it('describes the session, customer, warehouse and facility', async () => {
    const { view } = await run({ contracts: [contract('c1')] });
    expect(view).toMatchObject({
      sessionId: 'ses-1',
      expiresAt: session.expiresAt,
      ttlSeconds: 1200,
      warehouse: { id: 'w-1', code: 'W-1' },
      facility: { id: 'f-1', code: 'F-1' },
      customer: { id: 'u-1', fullName: 'An', phone: '0900' },
    });
  });

  it('allows both actions on a started contract with stock and no debt', async () => {
    const { view } = await run({
      contracts: [contract('c1')],
      stock: [item('c1', 'Sách', 2)],
    });
    expect(view.contracts[0]).toMatchObject({ dropOff: null, pickUp: null, returnOpen: false });
    expect(view.contracts[0].items).toHaveLength(1);
  });

  it('flags a contract that has not started and an empty shelf', async () => {
    const { view } = await run({
      contracts: [contract('c1', { effectiveAt: new Date('2027-01-01T00:00:00Z') })],
    });
    expect(view.contracts[0]).toMatchObject({
      dropOff: 'CONTRACT_NOT_STARTED',
      pickUp: 'NO_STOCK',
    });
  });

  it('blocks both when overdue, but pick-up stays allowed during a return', async () => {
    const { view } = await run({
      contracts: [contract('c1'), contract('c2', { returnOpen: true })],
      stock: [item('c1', 'Sách', 1), item('c2', 'Chăn', 1)],
      overdue: [{ invoiceNo: 'INV-1' }],
    });
    expect(view.overdueInvoiceNos).toEqual(['INV-1']);
    expect(view.contracts[0]).toMatchObject({
      dropOff: 'INVOICE_OVERDUE',
      pickUp: 'INVOICE_OVERDUE',
    });
    expect(view.contracts[1]).toMatchObject({ dropOff: 'INVOICE_OVERDUE', pickUp: null });
  });

  it('asks only for items in stock and groups recent receipts per contract', async () => {
    const { view, query } = await run({
      contracts: [contract('c1'), contract('c2')],
      stock: [item('c1', 'Sách', 2), item('c2', 'Chăn', 1)],
      receipts: [receiptRow('r1', 'c1'), receiptRow('r2', 'c2'), receiptRow('r3', 'c1')],
    });
    const stockSql = query.mock.calls.find(([sql]) => sql.includes('FROM "shelf_items"'))?.[0];
    expect(stockSql).toContain('"quantity" > 0');
    expect(view.contracts[0].recentReceipts.map((r) => r.id)).toEqual(['r1', 'r3']);
    expect(view.contracts[1].recentReceipts.map((r) => r.id)).toEqual(['r2']);
    expect(view.contracts[0].items.map((i) => i.name)).toEqual(['Sách']);
  });

  it('skips request and receipt queries when the customer has no contract here', async () => {
    const { view, query } = await run({});
    expect(view.contracts).toEqual([]);
    expect(query.mock.calls.some(([sql]) => sql.includes('"pickup_requests"'))).toBe(false);
  });
});
