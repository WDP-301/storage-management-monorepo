import { persistContract } from './initial-contract.util';

describe('persistContract amenity snapshot', () => {
  const item = {
    id: 'item-1',
    storageUnitId: 'unit-1',
    rentalMonths: 3,
    monthlyPriceSnapshot: '1000000.00',
  };
  const customer = { id: 'customer-1', fullName: 'Customer', email: 'c@example.com' };
  const build = () => ({
    create: jest.fn((_entity, data) => data),
    save: jest.fn(async (_entity, data) => ({ id: 'contract-1', ...data })),
    query: jest
      .fn()
      .mockResolvedValue([
        { amenityId: 'a-1', code: 'CCTV', name: 'Camera', quantity: 2, note: null },
      ]),
  });
  const input = { item, customer, effectiveAt: new Date('2026-10-01') } as never;

  it('freezes the unit amenities by default', async () => {
    const manager = build();

    const contract = await persistContract(manager as never, input);

    expect(manager.query).toHaveBeenCalledTimes(1);
    expect(contract.amenitiesSnapshot).toEqual([
      { amenityId: 'a-1', code: 'CCTV', name: 'Camera', quantity: 2, note: null },
    ]);
  });

  it('records null and runs no query when snapshotAmenities is false', async () => {
    const manager = build();

    const contract = await persistContract(
      manager as never,
      {
        ...(input as object),
        snapshotAmenities: false,
      } as never,
    );

    expect(manager.query).not.toHaveBeenCalled();
    expect(contract.amenitiesSnapshot).toBeNull();
  });
});
