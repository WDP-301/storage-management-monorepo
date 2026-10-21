import { Logger } from '@nestjs/common';
import { ContractStatus, DepositStatus } from '@storage/types';
import {
  captureDepositSafely,
  type DepositContract,
  resolveContractDeposit,
  resolveDepositAmounts,
} from './deposit-ledger.util';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'deposit-1',
  contractId: 'contract-1',
  paymentId: 'payment-1',
  amount: '2000000.00',
  heldAmount: '2000000.00',
  status: DepositStatus.HELD,
  ...overrides,
});

const contract = (overrides: Partial<DepositContract> = {}): DepositContract => ({
  id: 'contract-1',
  bookingItemId: 'item-1',
  status: ContractStatus.DRAFT,
  ...overrides,
});

/** Answers each statement the ledger issues the way PostgreSQL + TypeORM would. */
interface Db {
  lockOwn?: unknown[][];
  moved?: unknown[];
  inserted?: unknown[];
  own?: unknown[];
  onItem?: unknown[];
  paid?: unknown[];
}

function fakeManager(db: Db) {
  const lockOwn = [...(db.lockOwn ?? [])];
  const manager = {
    query: jest.fn(async (sql: string) => {
      const statement = sql.trim();
      if (statement.startsWith('UPDATE deposits')) return [db.moved ?? [], db.moved?.length ?? 0];
      if (statement.startsWith('INSERT INTO deposits')) return db.inserted ?? [];
      if (statement.includes('d.contract_id = $1 FOR UPDATE')) return lockOwn.shift() ?? [];
      if (statement.includes('d.contract_id = ANY')) return db.own ?? [];
      if (statement.includes('JOIN contracts c ON c.id = d.contract_id')) return db.onItem ?? [];
      if (statement.startsWith('WITH items')) return db.paid ?? [];
      throw new Error(`unexpected statement: ${statement.slice(0, 60)}`);
    }),
    transaction: jest.fn(async (callback: (em: unknown) => unknown) => callback(manager)),
  };
  return manager;
}

const statements = (manager: ReturnType<typeof fakeManager>) =>
  manager.query.mock.calls.map(([sql]) => (sql as string).trim());

describe('resolveContractDeposit with create', () => {
  it('returns the locked ledger row and writes nothing when the contract has one', async () => {
    const manager = fakeManager({ lockOwn: [[row()]] });

    await expect(
      resolveContractDeposit(manager as never, contract(), { create: true }),
    ).resolves.toEqual(row());

    expect(statements(manager)).toHaveLength(1);
    expect(statements(manager)[0]).toMatch(/FOR UPDATE$/);
  });

  it('moves a HELD deposit left on a cancelled contract of the item, soft-deleted or not', async () => {
    const manager = fakeManager({ moved: [row({ contractId: 'contract-2' })] });

    const deposit = await resolveContractDeposit(manager as never, contract({ id: 'contract-2' }), {
      create: true,
    });

    expect(deposit).toMatchObject({ id: 'deposit-1', contractId: 'contract-2' });
    const [sql, params] = manager.query.mock.calls[1];
    expect(sql).toMatch(/c\.status = 'CANCELLED' AND x\.status = 'HELD'/);
    expect(sql).not.toMatch(/deleted_at/);
    expect(params).toEqual(['contract-2', 'item-1']);
    expect(statements(manager).some((s) => s.startsWith('INSERT'))).toBe(false);
  });

  it('inserts the amount derived from the booking, idempotently', async () => {
    const manager = fakeManager({ inserted: [row()] });

    await expect(
      resolveContractDeposit(manager as never, contract(), { create: true }),
    ).resolves.toEqual(row());

    const [sql, params] = manager.query.mock.calls[2];
    expect(sql).toMatch(/ON CONFLICT \(contract_id\) DO NOTHING/);
    // One deposit per booking item: nothing is derived once any contract of the item has one.
    expect(sql).toMatch(/NOT EXISTS \(SELECT 1 FROM deposits x JOIN contracts c/);
    expect(params).toEqual(['contract-1', ['item-1']]);
  });

  it('returns the row a concurrent transaction recorded first', async () => {
    const manager = fakeManager({ lockOwn: [[], [row()]], inserted: [] });

    await expect(
      resolveContractDeposit(manager as never, contract(), { create: true }),
    ).resolves.toEqual(row());
  });

  it('returns null rather than 0 when the deposit cannot be derived', async () => {
    const manager = fakeManager({ inserted: [] });

    await expect(
      resolveContractDeposit(manager as never, contract(), { create: true }),
    ).resolves.toBeNull();
  });

  it('never records a deposit for a cancelled contract', async () => {
    const manager = fakeManager({});

    await expect(
      resolveContractDeposit(manager as never, contract({ status: ContractStatus.CANCELLED }), {
        create: true,
      }),
    ).resolves.toBeNull();
    expect(statements(manager)).toHaveLength(1);
  });
});

describe('resolveContractDeposit for reading', () => {
  it('returns the ledger row with its id and only reads', async () => {
    const manager = fakeManager({ own: [row()] });

    await expect(resolveContractDeposit(manager as never, contract())).resolves.toEqual({
      id: 'deposit-1',
      paymentId: 'payment-1',
      amount: '2000000.00',
      heldAmount: '2000000.00',
      status: DepositStatus.HELD,
    });
    expect(statements(manager).every((s) => s.startsWith('SELECT'))).toBe(true);
  });

  it('reports a HELD deposit still on a cancelled contract of the item, not yet moved', async () => {
    const manager = fakeManager({
      onItem: [
        row({
          contractId: 'old',
          contractStatus: ContractStatus.CANCELLED,
          bookingItemId: 'item-1',
        }),
      ],
    });

    await expect(
      resolveContractDeposit(manager as never, contract({ id: 'new' })),
    ).resolves.toMatchObject({ id: null, amount: '2000000.00', status: DepositStatus.HELD });
  });

  it('looks at every contract of the item, soft-deleted ones included', async () => {
    const manager = fakeManager({});

    await resolveContractDeposit(manager as never, contract());

    const itemLookup = statements(manager).find((s) => s.includes('c.booking_item_id = ANY'));
    expect(itemLookup).toBeDefined();
    expect(itemLookup).not.toMatch(/deleted_at/);
  });

  it('derives nothing when another live contract of the item holds the deposit', async () => {
    const manager = fakeManager({
      onItem: [
        row({
          contractId: 'other',
          contractStatus: ContractStatus.ACTIVE,
          bookingItemId: 'item-1',
        }),
      ],
    });

    await expect(resolveContractDeposit(manager as never, contract())).resolves.toBeNull();
    expect(statements(manager).some((s) => s.startsWith('WITH items'))).toBe(false);
  });

  it('derives the amount from the booking when the item has no deposit yet', async () => {
    const manager = fakeManager({
      paid: [{ item_id: 'item-1', amount: '1500000.00', payment_id: 'payment-9' }],
    });

    await expect(resolveContractDeposit(manager as never, contract())).resolves.toEqual({
      id: null,
      paymentId: 'payment-9',
      amount: '1500000.00',
      heldAmount: '1500000.00',
      status: DepositStatus.HELD,
    });
  });

  it.each([
    ['the formula cannot tell the items apart', [{ item_id: 'item-1', amount: null }]],
    ['the booking is not confirmed', []],
  ])('returns null when %s', async (_case, paid) => {
    const manager = fakeManager({ paid });

    await expect(resolveContractDeposit(manager as never, contract())).resolves.toBeNull();
  });

  it('subtracts the other items only while each of them still has a contract', async () => {
    const manager = fakeManager({});

    await resolveContractDeposit(manager as never, contract());

    // An item whose contracts were removed may carry an overwritten snapshot with no change
    // request left to show it, so the booking total minus the others is not trusted then.
    const formula = statements(manager).find((s) => s.startsWith('WITH items')) as string;
    expect(formula).toMatch(
      /EXISTS \(SELECT 1 FROM contracts c WHERE c\.booking_item_id = o\.id\) AS has_contract/,
    );
    expect(formula).toMatch(/WHEN pb\.changed_count = 1 AND pb\.contractless_count = 0\s/);
  });
});

describe('resolveDepositAmounts', () => {
  it("keeps a cancelled contract's deposit on it when its re-created contract is listed too", async () => {
    const held = row({ contractId: 'old', contractStatus: ContractStatus.CANCELLED });
    const manager = fakeManager({ own: [held], onItem: [{ ...held, bookingItemId: 'item-1' }] });

    const amounts = await resolveDepositAmounts(manager as never, [
      contract({ id: 'new' }),
      contract({ id: 'old', status: ContractStatus.CANCELLED }),
    ]);

    expect([...amounts]).toEqual([
      ['new', null],
      ['old', '2000000.00'],
    ]);
  });

  it('gives a left-over deposit to the first contract of the item only', async () => {
    const manager = fakeManager({
      onItem: [
        row({
          contractId: 'old',
          contractStatus: ContractStatus.CANCELLED,
          bookingItemId: 'item-1',
        }),
      ],
    });

    const amounts = await resolveDepositAmounts(manager as never, [
      contract({ id: 'first' }),
      contract({ id: 'second', status: ContractStatus.ACTIVE }),
    ]);

    expect([...amounts]).toEqual([
      ['first', '2000000.00'],
      ['second', null],
    ]);
  });

  it('derives an item deposit for one of its contracts only', async () => {
    const manager = fakeManager({
      paid: [{ item_id: 'item-1', amount: '1500000.00', payment_id: null }],
    });

    const amounts = await resolveDepositAmounts(manager as never, [
      contract({ id: 'first' }),
      contract({ id: 'second', status: ContractStatus.ACTIVE }),
    ]);

    expect([...amounts]).toEqual([
      ['first', '1500000.00'],
      ['second', null],
    ]);
  });

  it('maps each contract to its amount or null, without querying for an empty list', async () => {
    const manager = fakeManager({
      own: [row({ contractId: 'a' })],
      paid: [{ item_id: 'item-b', amount: '500000.00', payment_id: null }],
    });

    const amounts = await resolveDepositAmounts(manager as never, [
      contract({ id: 'a', bookingItemId: 'item-a' }),
      contract({ id: 'b', bookingItemId: 'item-b', status: ContractStatus.ACTIVE }),
      contract({ id: 'c', bookingItemId: 'item-c', status: ContractStatus.CANCELLED }),
    ]);

    expect([...amounts]).toEqual([
      ['a', '2000000.00'],
      ['b', '500000.00'],
      ['c', null],
    ]);
    await expect(resolveDepositAmounts(manager as never, [])).resolves.toEqual(new Map());
    expect(manager.query).toHaveBeenCalledTimes(3);
  });
});

describe('captureDepositSafely', () => {
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('records the deposit inside a savepoint', async () => {
    const manager = fakeManager({ inserted: [row()] });

    await expect(captureDepositSafely(manager as never, contract())).resolves.toEqual(row());
    expect(manager.transaction).toHaveBeenCalledTimes(1);
  });

  it('swallows and logs a failure so the caller still commits', async () => {
    const manager = fakeManager({});
    manager.transaction.mockRejectedValue(new Error('lock timeout'));

    await expect(captureDepositSafely(manager as never, contract())).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('contract-1'),
      expect.stringContaining('lock timeout'),
    );
  });

  it('logs a failure that is not an Error object', async () => {
    const manager = fakeManager({});
    manager.transaction.mockRejectedValue('connection reset');

    await expect(captureDepositSafely(manager as never, contract())).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('contract-1'),
      'connection reset',
    );
  });

  it('warns when the deposit cannot be derived yet', async () => {
    const manager = fakeManager({ inserted: [] });

    await expect(captureDepositSafely(manager as never, contract())).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('contract-1'));
  });
});
