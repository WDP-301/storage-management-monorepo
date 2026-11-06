import { loadReceipts } from './shelf-receipt.read';

const raw = (over: Record<string, unknown> = {}) => ({
  id: 'r-1',
  code: 'PG-20261107-AAAAAAAA',
  type: 'DROP_OFF',
  status: 'ACTIVE',
  contractId: 'c-1',
  contractNo: 'HD-1',
  shelfId: 's-1',
  shelfCode: 'K-1',
  shelfName: 'Kệ 1',
  warehouseId: 'w-1',
  warehouseCode: 'W-1',
  warehouseName: 'Kho 1',
  facilityId: 'f-1',
  facilityCode: 'F-1',
  facilityName: 'CN 1',
  customerId: 'u-1',
  customerName: 'An',
  customerPhone: '0900',
  performedById: 'st-1',
  performedByName: 'Bình',
  createdAt: new Date('2026-11-07T05:00:00Z'),
  note: null,
  photos: null,
  pickupRequestId: null,
  recovered: false,
  voidedAt: null,
  voidedById: null,
  voidedByName: null,
  voidReason: null,
  ...over,
});

const setup = (rows: unknown[], lines: unknown[] = [], total = 7) => {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('count(*)')) return [{ total }];
    if (sql.includes('FROM "shelf_receipt_lines"')) return lines;
    return rows;
  });
  return { em: { query } as never, query };
};
const call = (query: jest.Mock, needle: string) =>
  query.mock.calls.find(([sql]) => sql.includes(needle)) as [string, unknown[]];

describe('loadReceipts', () => {
  it('maps a live receipt: photos default to [], void is null, lines attached', async () => {
    const { em } = setup([raw()], [{ receiptId: 'r-1', itemId: 'i-1', name: 'Sách', quantity: 2 }]);
    const { receipts } = await loadReceipts(em, { ids: ['r-1'] });
    expect(receipts).toEqual([
      expect.objectContaining({
        id: 'r-1',
        photos: [],
        void: null,
        recovered: false,
        shelf: { id: 's-1', code: 'K-1', name: 'Kệ 1' },
        customer: { id: 'u-1', fullName: 'An', phone: '0900' },
        performedBy: { id: 'st-1', fullName: 'Bình' },
        lines: [{ itemId: 'i-1', name: 'Sách', quantity: 2 }],
      }),
    ]);
  });

  it('maps a voided receipt and a scan-less recovery', async () => {
    const at = new Date('2026-11-08T00:00:00Z');
    const { em } = setup([
      raw({
        status: 'VOIDED',
        voidedAt: at,
        voidedById: 'm-1',
        voidedByName: 'Quản lý',
        voidReason: 'Nhầm',
        recovered: true,
      }),
    ]);
    const [receipt] = (await loadReceipts(em, {})).receipts;
    expect(receipt.void).toEqual({ at, by: { id: 'm-1', fullName: 'Quản lý' }, reason: 'Nhầm' });
    expect(receipt.recovered).toBe(true);
  });

  it('returns nothing without querying lines when no receipt matches', async () => {
    const { em, query } = setup([]);
    await expect(loadReceipts(em, { ids: ['x'] })).resolves.toEqual({ receipts: [], total: 0 });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('filters by warehouse and escapes the search term over code, name and phone', async () => {
    const { em, query } = setup([raw()]);
    await loadReceipts(em, { warehouseId: 'w-1', search: ' 50%_ ' });
    const [sql, params] = call(query, 'FROM "shelf_receipts" r');
    expect(sql).toContain('r."warehouse_id" = $1');
    expect(sql).toContain('r."code" ILIKE $2 OR cu."full_name" ILIKE $2 OR cu."phone" ILIKE $2');
    expect(params).toEqual(['w-1', '%50\\%\\_%']);
  });

  it('pages newest first and counts the total', async () => {
    const { em, query } = setup([raw()], [], 45);
    const result = await loadReceipts(em, { contractIds: ['c-1'], page: 3, limit: 20 });
    expect(result.total).toBe(45);
    const [sql, params] = call(query, 'ORDER BY r."created_at" DESC');
    expect(sql).toMatch(/LIMIT \$2 OFFSET \$3/);
    expect(params).toEqual([['c-1'], 20, 40]);
  });

  it('keeps the newest N per contract with a window function', async () => {
    const { em, query } = setup([raw()]);
    await loadReceipts(em, { contractIds: ['c-1', 'c-2'], recentPerContract: 5 });
    const [sql, params] = call(query, 'ORDER BY r."created_at" DESC');
    expect(sql).toContain('PARTITION BY "contract_id" ORDER BY "created_at" DESC');
    expect(sql).toContain('t.rn <= $2');
    expect(params).toEqual([['c-1', 'c-2'], 5]);
  });
});
