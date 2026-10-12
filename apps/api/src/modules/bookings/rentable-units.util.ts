import type { StorageUnit } from '@entities/storage-unit.entity';
import { StorageUnitKind, StorageUnitStatus } from '@storage/types';

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
