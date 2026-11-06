import { findReplay, insertReceipt, withReceiptCodeRetry } from './receipt-writer.util';

jest.mock('./shelf-receipt.read', () => ({
  loadReceipts: jest.fn(async () => ({ receipts: [{ id: 'r-1' }], total: 0 })),
}));

const unique = () => Object.assign(new Error('dup'), { code: '23505' });

describe('withReceiptCodeRetry', () => {
  const dataSource = (outcomes: (() => unknown)[]) => {
    const transaction = jest.fn(async (run: (em: unknown) => unknown) => {
      const outcome = outcomes.shift() as () => unknown;
      return outcome() ?? run({});
    });
    return { transaction } as never;
  };

  it('retries once in a fresh transaction after a unique violation', async () => {
    const ds = dataSource([
      () => {
        throw unique();
      },
      () => 'saved',
    ]);
    await expect(withReceiptCodeRetry(ds, async () => 'x')).resolves.toBe('saved');
    expect((ds as { transaction: jest.Mock }).transaction).toHaveBeenCalledTimes(2);
  });

  it('gives up after three collisions', async () => {
    const ds = dataSource([
      () => {
        throw unique();
      },
      () => {
        throw unique();
      },
      () => {
        throw unique();
      },
    ]);
    await expect(withReceiptCodeRetry(ds, async () => 'x')).rejects.toMatchObject({
      code: '23505',
    });
    expect((ds as { transaction: jest.Mock }).transaction).toHaveBeenCalledTimes(3);
  });

  it('rethrows other errors at once', async () => {
    const boom = new Error('boom');
    const ds = dataSource([
      () => {
        throw boom;
      },
    ]);
    await expect(withReceiptCodeRetry(ds, async () => 'x')).rejects.toBe(boom);
    expect((ds as { transaction: jest.Mock }).transaction).toHaveBeenCalledTimes(1);
  });
});

describe('findReplay', () => {
  const em = (existing: unknown[]) =>
    ({
      query: jest.fn(async (sql: string) => (sql.includes('"client_request_id"') ? existing : [])),
    }) as never;

  it('returns null when the request id is new', async () => {
    await expect(findReplay(em([]), 'req-1', 'c-1')).resolves.toBeNull();
  });

  it('refuses a request id already used on another contract', async () => {
    await expect(
      findReplay(em([{ id: 'r-1', contractId: 'c-2' }]), 'req-1', 'c-1'),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'SHELF_RECEIPT_NOT_ALLOWED', details: { reason: 'CLIENT_REQUEST_REUSED' } },
    });
  });

  it('answers the saved receipt for the same contract', async () => {
    await expect(
      findReplay(em([{ id: 'r-1', contractId: 'c-1' }]), 'req-1', 'c-1'),
    ).resolves.toEqual({
      id: 'r-1',
    });
  });
});

describe('insertReceipt', () => {
  it('writes the receipt with snapshots, then its lines', async () => {
    const query = jest.fn(async (sql: string, _params?: unknown[]) =>
      sql.includes('INTO "shelf_receipts"') ? [{ id: 'r-1' }] : [],
    );
    const id = await insertReceipt({ query } as never, {
      type: 'PICK_UP',
      contract: {
        id: 'c-1',
        customerId: 'u-1',
        shelf: { id: 's-1' },
        warehouse: { id: 'w-1' },
        facility: { id: 'f-1' },
      } as never,
      sessionId: null,
      clientRequestId: 'req-1',
      performedBy: 'm-1',
      note: 'ghi chú',
      photos: [{ fileKey: 'uploads/m-1-a', name: 'a', mimeType: 'image/jpeg' }],
      pickupRequestId: null,
      lines: [{ itemId: 'i-1', name: 'Sách', quantity: 2 }],
    });
    expect(id).toBe('r-1');
    const [, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(params[0]).toMatch(/^PL-\d{8}-[0-9A-F]{8}$/);
    expect(params.slice(1)).toEqual([
      'PICK_UP',
      'c-1',
      'u-1',
      's-1',
      'w-1',
      'f-1',
      null,
      'req-1',
      'm-1',
      'ghi chú',
      JSON.stringify([{ fileKey: 'uploads/m-1-a', name: 'a', mimeType: 'image/jpeg' }]),
      null,
    ]);
    expect(query.mock.calls[1][1]).toEqual(['r-1', ['i-1'], ['Sách'], [2]]);
  });
});
