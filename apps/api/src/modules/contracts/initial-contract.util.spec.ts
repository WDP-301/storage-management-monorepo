import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { Logger } from '@nestjs/common';
import { persistContract } from './initial-contract.util';

describe('persistContract', () => {
  const item = {
    id: 'item-1',
    storageUnitId: 'unit-1',
    rentalMonths: 3,
    monthlyPriceSnapshot: '1000000.00',
  };
  const customer = { id: 'customer-1', fullName: 'Customer', email: 'c@example.com' };
  const amenity = { amenityId: 'a-1', code: 'CCTV', name: 'Camera', quantity: 2, note: null };
  const deposit = {
    id: 'deposit-1',
    contractId: 'contract-1',
    paymentId: 'payment-1',
    amount: '2000000.00',
    heldAmount: '2000000.00',
    status: 'HELD',
  };
  const build = () => {
    const manager = {
      create: jest.fn((_entity, data) => data),
      save: jest.fn(async (_entity, data) => ({ id: 'contract-1', ...data })),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('storage_unit_amenities')) return [amenity];
        if (sql.trimStart().startsWith('UPDATE')) return [[], 0];
        if (sql.trimStart().startsWith('INSERT INTO deposits')) return [deposit];
        return [];
      }),
      // A nested transaction on a transactional manager is a savepoint on the same connection.
      transaction: jest.fn(async (callback: (em: unknown) => unknown) => callback(manager)),
    };
    return manager;
  };
  const input = { item, customer, effectiveAt: new Date('2026-10-01') } as never;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('freezes the unit amenities by default', async () => {
    const manager = build();

    const contract = await persistContract(manager as never, input);

    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('storage_unit_amenities'), [
      'unit-1',
    ]);
    expect(contract.amenitiesSnapshot).toEqual([amenity]);
  });

  it('records null and runs no amenity query when snapshotAmenities is false', async () => {
    const manager = build();

    const contract = await persistContract(
      manager as never,
      { ...(input as object), snapshotAmenities: false } as never,
    );

    expect(manager.query).not.toHaveBeenCalledWith(
      expect.stringContaining('storage_unit_amenities'),
      expect.anything(),
    );
    expect(contract.amenitiesSnapshot).toBeNull();
  });

  it('records the deposit in a savepoint after the contract and its handover inspection', async () => {
    const manager = build();

    await persistContract(manager as never, input);

    expect(manager.transaction).toHaveBeenCalledTimes(1);
    const inspectionSave = manager.save.mock.calls.findIndex(([entity]) => entity === Inspection);
    expect(manager.save.mock.invocationCallOrder[inspectionSave]).toBeLessThan(
      manager.transaction.mock.invocationCallOrder[0],
    );
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\s*INSERT INTO deposits[\s\S]*ON CONFLICT \(contract_id\) DO NOTHING/,
      ),
      ['contract-1', ['item-1']],
    );
  });

  it('returns the saved contract when the deposit cannot be recorded', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const manager = build();
    manager.transaction.mockRejectedValue(new Error('lock timeout'));

    const contract = await persistContract(manager as never, input);

    expect(contract).toMatchObject({ id: 'contract-1', bookingItemId: 'item-1' });
    expect(manager.save).toHaveBeenCalledWith(Contract, expect.anything());
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('contract-1'),
      expect.stringContaining('lock timeout'),
    );
  });
});
