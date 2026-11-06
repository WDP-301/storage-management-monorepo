import type { EntityManager } from 'typeorm';
import { findShelfContracts, loadStock } from './shelf-contract.query';

const raw = {
  id: 'c-1',
  contractNo: 'HD-1',
  status: 'ACTIVE',
  customerId: 'u-1',
  effectiveAt: new Date('2026-11-01T00:00:00Z'),
  shelfId: 's-1',
  shelfCode: 'K-1',
  shelfName: 'Kệ 1',
  warehouseId: 'w-1',
  warehouseCode: 'W-1',
  warehouseName: 'Kho 1',
  facilityId: 'f-1',
  facilityCode: 'F-1',
  facilityName: 'Chi nhánh 1',
  returnOpen: true,
};

const emWith = (rows: unknown[]) => {
  const query = jest.fn(async () => rows);
  return { em: { query } as unknown as EntityManager, query };
};

describe('findShelfContracts', () => {
  it('maps rows into nested refs', async () => {
    const { em } = emWith([raw]);
    const [row] = await findShelfContracts(em, { customerId: 'u-1' });
    expect(row).toEqual({
      id: 'c-1',
      contractNo: 'HD-1',
      status: 'ACTIVE',
      customerId: 'u-1',
      effectiveAt: raw.effectiveAt,
      shelf: { id: 's-1', code: 'K-1', name: 'Kệ 1' },
      warehouse: { id: 'w-1', code: 'W-1', name: 'Kho 1' },
      facility: { id: 'f-1', code: 'F-1', name: 'Chi nhánh 1' },
      returnOpen: true,
    });
  });

  it('always hides deleted contracts and non-shelf units', async () => {
    const { em, query } = emWith([]);
    await findShelfContracts(em);
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('c."deleted_at" IS NULL');
    expect(sql).toContain(`u."kind" = 'SHELF'`);
    expect(sql).toContain('i."finalized_at" IS NULL');
    expect(sql).not.toContain('FOR NO KEY UPDATE');
    expect(params).toEqual([]);
  });

  it('binds every filter as a parameter', async () => {
    const { em, query } = emWith([]);
    await findShelfContracts(em, {
      contractId: 'c-1',
      customerId: 'u-1',
      warehouseId: 'w-1',
      statuses: ['ACTIVE'],
    });
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(params).toEqual(['c-1', 'u-1', 'w-1', ['ACTIVE']]);
    expect(sql).toContain('c."id" = $1');
    expect(sql).toContain('c."customer_id" = $2');
    expect(sql).toContain('w."id" = $3');
    expect(sql).toContain('c."status" = ANY($4::text[])');
  });

  it('locks the contract in its own statement before the join', async () => {
    const { em, query } = emWith([]);
    await findShelfContracts(em, { contractId: 'c-1', lock: true });
    const calls = query.mock.calls as unknown as [string, unknown[]][];
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toContain('FOR NO KEY UPDATE');
    expect(calls[0][0]).not.toContain('JOIN');
    expect(calls[0][1]).toEqual([['c-1']]);
    expect(calls[1][0]).toContain('JOIN "booking_items"');
    expect(calls[1][0]).not.toContain('FOR NO KEY UPDATE');
  });

  it('refuses to lock without a contract id', async () => {
    const { em } = emWith([]);
    await expect(findShelfContracts(em, { customerId: 'u-1', lock: true })).rejects.toThrow(
      /contractId/,
    );
  });
});

describe('loadStock', () => {
  const rows = [
    { id: 'i-1', contractId: 'c-1', name: 'Chăn', quantity: 2, updatedAt: new Date(0) },
    { id: 'i-2', contractId: 'c-2', name: 'Sách', quantity: 5, updatedAt: new Date(0) },
  ];

  it('groups items by contract and gives empty contracts an empty list', async () => {
    const { em } = emWith(rows);
    const stock = await loadStock(em, ['c-1', 'c-2', 'c-3']);
    expect(stock.get('c-1')).toEqual([
      { id: 'i-1', name: 'Chăn', quantity: 2, updatedAt: new Date(0) },
    ]);
    expect(stock.get('c-2')?.[0].name).toBe('Sách');
    expect(stock.get('c-3')).toEqual([]);
  });

  it('hides empty items and orders by name by default', async () => {
    const { em, query } = emWith([]);
    await loadStock(em, ['c-1']);
    const [sql] = query.mock.calls[0] as unknown as [string];
    expect(sql).toContain('"quantity" > 0');
    expect(sql).toContain('ORDER BY "name" ASC');
    expect(sql).not.toContain('FOR UPDATE');
  });

  it('locks in id order and can include empty items', async () => {
    const { em, query } = emWith([]);
    await loadStock(em, ['c-1'], { lock: true, includeEmpty: true });
    const [sql] = query.mock.calls[0] as unknown as [string];
    expect(sql).not.toContain('"quantity" > 0');
    expect(sql).toContain('ORDER BY "id" FOR UPDATE');
  });

  it('skips the query when there are no contracts', async () => {
    const { em, query } = emWith([]);
    expect((await loadStock(em, [])).size).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });
});
