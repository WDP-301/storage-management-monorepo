import { StorageUnit } from '@entities/storage-unit.entity';
import { StorageUnitKind, StorageUnitStatus } from '@storage/types';
import { type EntityManager, In } from 'typeorm';

/**
 * Ids of units a customer cannot rent right now for structural reasons: a shelf warehouse is
 * only a container, and a shelf is closed together with its parent warehouse. `parent` must be
 * loaded; a soft-deleted parent comes back null from the join and counts as closed.
 */
export function findUnrentable(units: Pick<StorageUnit, 'id' | 'kind' | 'parent'>[]): string[] {
  return units
    .filter((u) => {
      if (u.kind === StorageUnitKind.SHELF_WAREHOUSE) return true;
      if (u.kind === StorageUnitKind.SHELF) {
        return !u.parent || u.parent.status !== StorageUnitStatus.AVAILABLE;
      }
      return false;
    })
    .map((u) => u.id);
}

/**
 * Shared-locks the parent warehouses of the given shelves so a concurrent status change of the
 * building waits for the rental to commit, and a rental reading the parent afterwards sees the
 * committed status. Take it before locking the shelf rows: warehouse writes lock the building
 * first, then its shelves. A shelf's parent never changes, so an unlocked read of `parentId` is safe.
 */
export async function lockShelfParents(
  manager: EntityManager,
  units: Pick<StorageUnit, 'parentId'>[],
): Promise<void> {
  const ids = [...new Set(units.map((u) => u.parentId).filter((id): id is string => !!id))].sort();
  if (ids.length === 0) return;
  await manager.find(StorageUnit, {
    where: { id: In(ids) },
    order: { id: 'ASC' },
    lock: { mode: 'pessimistic_read' },
    withDeleted: true,
  });
}
