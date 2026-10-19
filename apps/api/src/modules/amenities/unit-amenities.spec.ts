import { Amenity } from '@entities/amenity.entity';
import { StorageUnitAmenity } from '@entities/storage-unit-amenity.entity';
import { loadUnitAmenities, replaceUnitAmenities } from './unit-amenities';

const catalog = [
  { id: 'am-1', code: 'CCTV', isActive: true },
  { id: 'am-2', code: 'LIGHTING', isActive: false },
];

function fakeManager(attachedIds: string[] = []) {
  return {
    // Returns the whole catalog for any id lookup: ids the caller asked for but that are absent
    // still surface as unknown, without depending on how TypeORM represents `In()`.
    find: jest.fn(async (entity: unknown) =>
      entity === Amenity ? catalog : attachedIds.map((amenityId) => ({ amenityId })),
    ),
    delete: jest.fn().mockResolvedValue(undefined),
    insert: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(),
  };
}

const run = (
  manager: ReturnType<typeof fakeManager>,
  items: Parameters<typeof replaceUnitAmenities>[2],
) => replaceUnitAmenities(manager as never, 'unit-1', items);

describe('replaceUnitAmenities', () => {
  it('replaces the list: deletes the old rows, then inserts the new ones', async () => {
    const manager = fakeManager();

    await run(manager, [{ amenityId: 'am-1', quantity: 3, note: '  north wall ' }]);

    expect(manager.delete).toHaveBeenCalledWith(StorageUnitAmenity, { storageUnitId: 'unit-1' });
    expect(manager.insert).toHaveBeenCalledWith(StorageUnitAmenity, [
      { storageUnitId: 'unit-1', amenityId: 'am-1', quantity: 3, note: 'north wall' },
    ]);
    expect(manager.delete.mock.invocationCallOrder[0]).toBeLessThan(
      manager.insert.mock.invocationCallOrder[0],
    );
  });

  it('stores a blank note as null', async () => {
    const manager = fakeManager();

    await run(manager, [{ amenityId: 'am-1', quantity: 1, note: '   ' }]);

    expect(manager.insert.mock.calls[0][1][0].note).toBeNull();
  });

  it('removes everything with [] and touches no catalog', async () => {
    const manager = fakeManager(['am-1']);

    await run(manager, []);

    expect(manager.find).not.toHaveBeenCalled();
    expect(manager.delete).toHaveBeenCalledWith(StorageUnitAmenity, { storageUnitId: 'unit-1' });
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('rejects an unknown amenity as a field error and writes nothing', async () => {
    const manager = fakeManager();

    await expect(run(manager, [{ amenityId: 'missing', quantity: 1 }])).rejects.toMatchObject({
      status: 400,
      response: {
        details: { fields: [expect.objectContaining({ field: 'amenities', code: 'notFound' })] },
      },
    });
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('rejects a retired amenity the warehouse does not carry', async () => {
    const manager = fakeManager();

    await expect(run(manager, [{ amenityId: 'am-2', quantity: 1 }])).rejects.toMatchObject({
      status: 400,
      response: {
        details: { fields: [expect.objectContaining({ field: 'amenities', code: 'inactive' })] },
      },
    });
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('keeps a retired amenity the warehouse already carries', async () => {
    const manager = fakeManager(['am-2']);

    await run(manager, [{ amenityId: 'am-2', quantity: 4 }]);

    expect(manager.insert).toHaveBeenCalled();
  });
});

describe('loadUnitAmenities', () => {
  it('runs no query for an empty id list', async () => {
    const manager = fakeManager();

    await expect(loadUnitAmenities(manager as never, [])).resolves.toEqual(new Map());
    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('groups rows per unit and maps units without rows to []', async () => {
    const rows = [
      {
        storageUnitId: 'u1',
        amenityId: 'a',
        quantity: 2,
        note: 'x',
        amenity: { code: 'CCTV', name: 'Camera', isActive: true },
      },
      {
        storageUnitId: 'u1',
        amenityId: 'b',
        quantity: 1,
        note: null,
        amenity: { code: 'LIGHT', name: 'Đèn', isActive: false },
      },
      {
        storageUnitId: 'u2',
        amenityId: 'a',
        quantity: 5,
        note: null,
        amenity: { code: 'CCTV', name: 'Camera', isActive: true },
      },
    ];
    const qb: Record<string, jest.Mock> = {};
    for (const name of ['innerJoinAndSelect', 'where', 'orderBy', 'addOrderBy']) {
      qb[name] = jest.fn(() => qb);
    }
    qb.getMany = jest.fn().mockResolvedValue(rows);
    const manager = { createQueryBuilder: jest.fn(() => qb) };

    const result = await loadUnitAmenities(manager as never, ['u1', 'u2', 'u3']);

    expect(manager.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(result.get('u1')).toEqual([
      { amenityId: 'a', code: 'CCTV', name: 'Camera', quantity: 2, note: 'x', isActive: true },
      // A retired amenity stays visible on the warehouse that still carries it.
      { amenityId: 'b', code: 'LIGHT', name: 'Đèn', quantity: 1, note: null, isActive: false },
    ]);
    expect(result.get('u2')).toHaveLength(1);
    expect(result.get('u3')).toEqual([]);
  });
});
