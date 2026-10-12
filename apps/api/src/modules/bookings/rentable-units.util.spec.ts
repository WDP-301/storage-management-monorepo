import { StorageUnitKind, StorageUnitStatus } from '@storage/types';
import { findUnrentable } from './rentable-units.util';

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
