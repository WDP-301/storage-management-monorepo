import type { EntityManager } from 'typeorm';
import { loadPickupRequests } from './pickup-request.read';

const base = {
  id: 'r-1',
  status: 'READY',
  contractId: 'c-1',
  contractNo: 'HD-1',
  shelfId: 's-1',
  shelfCode: 'K-1',
  shelfName: 'Kệ 1',
  warehouseId: 'w-1',
  warehouseCode: 'W-1',
  warehouseName: 'Kho 1',
  customerId: 'u-1',
  customerName: 'An',
  customerPhone: '0900000000',
  requestedFor: new Date('2026-11-12T03:00:00Z'),
  note: null,
  lines: [
    { itemId: 'i-1', name: 'Chăn', quantity: 2 },
    { itemId: 'i-2', name: 'Sách', quantity: 1 },
  ],
  createdAt: new Date('2026-11-07T00:00:00Z'),
  readyAt: new Date('2026-11-08T00:00:00Z'),
  readyById: 'st-1',
  readyByName: 'Bình',
  cancelledAt: null,
  cancelledById: null,
  completedAt: null,
  completedReceiptId: null,
};

function emFor(requests: unknown[], stock: unknown[] = []) {
  const query = jest.fn(async (sql: string) =>
    sql.includes('FROM "shelf_items"') ? stock : requests,
  );
  return { em: { query } as unknown as EntityManager, query };
}

describe('loadPickupRequests', () => {
  it('maps a request with current stock per line and the staff who prepared it', async () => {
    const { em } = emFor([base], [{ id: 'i-1', quantity: 5 }]);
    const [view] = await loadPickupRequests(em, { order: 'newest' });
    expect(view.lines).toEqual([
      { itemId: 'i-1', name: 'Chăn', quantity: 2, available: 5 },
      { itemId: 'i-2', name: 'Sách', quantity: 1, available: 0 },
    ]);
    expect(view.readyBy).toEqual({ id: 'st-1', fullName: 'Bình' });
    expect(view.customer).toEqual({ id: 'u-1', fullName: 'An', phone: '0900000000' });
    expect(view.cancelledBy).toBeNull();
  });

  it('tells a customer cancellation from a system one', async () => {
    const cancelled = { ...base, status: 'CANCELLED', cancelledAt: new Date() };
    const { em } = emFor([
      { ...cancelled, id: 'r-a', cancelledById: 'u-1' },
      { ...cancelled, id: 'r-b', cancelledById: null },
    ]);
    const views = await loadPickupRequests(em, { order: 'newest' });
    expect(views.map((view) => view.cancelledBy)).toEqual(['CUSTOMER', 'SYSTEM']);
  });

  it('links the completing receipt', async () => {
    const { em } = emFor([{ ...base, status: 'COMPLETED', completedReceiptId: 'rc-1' }]);
    const [view] = await loadPickupRequests(em, { order: 'newest' });
    expect(view.completedReceiptId).toBe('rc-1');
  });

  it('binds filters and honours order and limit', async () => {
    const { em, query } = emFor([]);
    await loadPickupRequests(em, {
      warehouseId: 'w-1',
      contractIds: ['c-1'],
      open: true,
      limit: 20,
      order: 'requestedFor',
    });
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(params).toEqual([['c-1'], 'w-1', 20]);
    expect(sql).toContain('r."contract_id" = ANY($1::uuid[])');
    expect(sql).toContain('w."id" = $2');
    expect(sql).toContain(`r."status" IN ('PENDING','READY')`);
    expect(sql).toContain('ORDER BY r."requested_for" ASC');
    expect(sql).toContain('LIMIT $3');
  });

  it('returns nothing without a stock lookup when no request matches', async () => {
    const { em, query } = emFor([]);
    expect(await loadPickupRequests(em, { ids: ['x'], order: 'newest' })).toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
