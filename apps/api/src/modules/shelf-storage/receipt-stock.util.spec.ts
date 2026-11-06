import type { ShelfItemView } from '@storage/types';
import { applyDropOff, applyPickUp, reverseReceiptStock } from './receipt-stock.util';

const at = new Date();
const item = (id: string, name: string, quantity: number): ShelfItemView => ({
  id,
  name,
  quantity,
  updatedAt: at,
});
const stock = [item('i-1', 'Thùng Sách', 5), item('i-2', 'Chăn', 0)];

const setup = () => {
  let n = 0;
  const query = jest.fn(async (sql: string, _params?: unknown[]) =>
    sql.startsWith('INSERT') ? [{ id: `new-${++n}` }] : [[], 1],
  );
  return { em: { query } as never, query };
};
const update = (query: jest.Mock) =>
  query.mock.calls.find(([sql]) => sql.startsWith('UPDATE')) as [string, unknown[]] | undefined;
const errorOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as { status: number; response: { code: string; details: unknown } };
  }
  throw new Error('did not throw');
};

describe('applyDropOff', () => {
  it('tops up by item id, even an emptied item', async () => {
    const { em, query } = setup();
    const applied = await applyDropOff(em, 'c-1', [{ itemId: 'i-2', quantity: 3 }], stock);
    expect(applied).toEqual([{ itemId: 'i-2', name: 'Chăn', quantity: 3 }]);
    expect(update(query)?.[1]).toEqual([['i-2'], [3]]);
  });

  it('tops up by name ignoring case and spacing, keeping the stored name', async () => {
    const { em, query } = setup();
    const applied = await applyDropOff(em, 'c-1', [{ name: 'thùng sách', quantity: 2 }], stock);
    expect(applied).toEqual([{ itemId: 'i-1', name: 'Thùng Sách', quantity: 2 }]);
    expect(query.mock.calls.some(([sql]) => sql.startsWith('INSERT'))).toBe(false);
  });

  it('inserts a new item for an unknown name', async () => {
    const { em, query } = setup();
    const applied = await applyDropOff(em, 'c-1', [{ name: 'Đèn', quantity: 4 }], stock);
    expect(applied).toEqual([{ itemId: 'new-1', name: 'Đèn', quantity: 4 }]);
    expect(query.mock.calls[0][1]).toEqual(['c-1', 'Đèn', 4]);
    expect(update(query)).toBeUndefined();
  });

  it('merges into the existing item when the database sees the name as taken', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.startsWith('INSERT')) return [];
      if (sql.startsWith('SELECT')) return [{ id: 'i-9', name: 'Lều' }];
      return [[], 1];
    });
    const applied = await applyDropOff(
      { query } as never,
      'c-1',
      [{ name: 'LỀU', quantity: 2 }],
      stock,
    );
    expect(applied).toEqual([{ itemId: 'i-9', name: 'Lều', quantity: 2 }]);
    expect(update(query as never)?.[1]).toEqual([['i-9'], [2]]);
  });

  it('merges an id line and a name line that land on the same item', async () => {
    const { em, query } = setup();
    const applied = await applyDropOff(
      em,
      'c-1',
      [
        { itemId: 'i-1', quantity: 1 },
        { name: 'THÙNG SÁCH', quantity: 2 },
      ],
      stock,
    );
    expect(applied).toEqual([{ itemId: 'i-1', name: 'Thùng Sách', quantity: 3 }]);
    expect(update(query)?.[1]).toEqual([['i-1'], [3]]);
  });

  it('refuses an item id outside the contract and writes nothing', async () => {
    const { em, query } = setup();
    const error = await errorOf(applyDropOff(em, 'c-1', [{ itemId: 'zzz', quantity: 1 }], stock));
    expect(error.response).toMatchObject({
      code: 'SHELF_RECEIPT_NOT_ALLOWED',
      details: { reason: 'ITEM_NOT_IN_CONTRACT', itemIds: ['zzz'] },
    });
    expect(query).not.toHaveBeenCalled();
  });
});

describe('applyPickUp', () => {
  it('subtracts the quantities', async () => {
    const { em, query } = setup();
    const applied = await applyPickUp(em, [{ itemId: 'i-1', quantity: 5 }], stock);
    expect(applied).toEqual([{ itemId: 'i-1', name: 'Thùng Sách', quantity: 5 }]);
    expect(update(query)?.[1]).toEqual([['i-1'], [-5]]);
  });

  it('lists every shortage together and changes nothing', async () => {
    const { em, query } = setup();
    const error = await errorOf(
      applyPickUp(
        em,
        [
          { itemId: 'i-1', quantity: 6 },
          { itemId: 'i-2', quantity: 1 },
        ],
        stock,
      ),
    );
    expect(error.status).toBe(409);
    expect(error.response).toMatchObject({
      code: 'SHELF_STOCK_INSUFFICIENT',
      details: {
        reason: 'PICK_UP',
        items: [
          { itemId: 'i-1', name: 'Thùng Sách', requested: 6, available: 5 },
          { itemId: 'i-2', name: 'Chăn', requested: 1, available: 0 },
        ],
      },
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('refuses an item outside the contract', async () => {
    const { em } = setup();
    const error = await errorOf(applyPickUp(em, [{ itemId: 'zzz', quantity: 1 }], stock));
    expect(error.response.details).toMatchObject({ reason: 'ITEM_NOT_IN_CONTRACT' });
  });
});

describe('reverseReceiptStock', () => {
  const lines = [{ itemId: 'i-1', name: 'Thùng Sách', quantity: 5 }];

  it('takes a voided drop-off back off the shelf', async () => {
    const { em, query } = setup();
    await reverseReceiptStock(em, 'DROP_OFF', lines, stock);
    expect(update(query)?.[1]).toEqual([['i-1'], [-5]]);
  });

  it('refuses to void a drop-off whose goods were taken since (reason VOID)', async () => {
    const { em, query } = setup();
    const error = await errorOf(
      reverseReceiptStock(em, 'DROP_OFF', [{ ...lines[0], quantity: 6 }], stock),
    );
    expect(error.response).toMatchObject({
      code: 'SHELF_STOCK_INSUFFICIENT',
      details: { reason: 'VOID', items: [{ itemId: 'i-1', requested: 6, available: 5 }] },
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('puts a voided pick-up back on the shelf', async () => {
    const { em, query } = setup();
    await reverseReceiptStock(em, 'PICK_UP', lines, stock);
    expect(update(query)?.[1]).toEqual([['i-1'], [5]]);
  });
});
