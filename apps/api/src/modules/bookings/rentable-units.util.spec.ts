import { StorageUnit } from '@entities/storage-unit.entity';
import { StorageUnitKind, StorageUnitStatus } from '@storage/types';
import { In } from 'typeorm';
import { findUnrentable, lockShelfParents } from './rentable-units.util';

type Unit = Parameters<typeof findUnrentable>[0][number];

const parent = (status: StorageUnitStatus) => ({ status }) as NonNullable<Unit['parent']>;

describe('findUnrentable', () => {
  it.each<[string, Unit, boolean]>([
    ['self-storage unit', { id: 'u', kind: StorageUnitKind.SELF_STORAGE, parent: null }, false],
    ['shelf warehouse', { id: 'u', kind: StorageUnitKind.SHELF_WAREHOUSE, parent: null }, true],
    [
      'shelf under an available parent',
      { id: 'u', kind: StorageUnitKind.SHELF, parent: parent(StorageUnitStatus.AVAILABLE) },
      false,
    ],
    [
      'shelf under a maintenance parent',
      { id: 'u', kind: StorageUnitKind.SHELF, parent: parent(StorageUnitStatus.MAINTENANCE) },
      true,
    ],
    ['shelf whose parent is gone', { id: 'u', kind: StorageUnitKind.SHELF, parent: null }, true],
  ])('%s', (_name, unit, unrentable) => {
    expect(findUnrentable([unit])).toEqual(unrentable ? ['u'] : []);
  });
});

describe('lockShelfParents', () => {
  it('share-locks each distinct parent once, in id order', async () => {
    const manager = { find: jest.fn().mockResolvedValue([]) };

    await lockShelfParents(manager as never, [
      { parentId: 'p-2' },
      { parentId: null },
      { parentId: 'p-1' },
      { parentId: 'p-2' },
    ]);

    expect(manager.find).toHaveBeenCalledTimes(1);
    expect(manager.find).toHaveBeenCalledWith(StorageUnit, {
      where: { id: In(['p-1', 'p-2']) },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_read' },
      withDeleted: true,
    });
  });

  it('takes no lock when no unit is a shelf', async () => {
    const manager = { find: jest.fn() };

    await lockShelfParents(manager as never, [{ parentId: null }]);

    expect(manager.find).not.toHaveBeenCalled();
  });
});
