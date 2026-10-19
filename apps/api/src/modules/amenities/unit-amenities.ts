import { Amenity } from '@entities/amenity.entity';
import { StorageUnitAmenity } from '@entities/storage-unit-amenity.entity';
import { fieldValidationError } from '@shared/exceptions/domain.exception';
import type { EntityManager } from 'typeorm';
import { In } from 'typeorm';

/** Most distinct amenities one warehouse can carry. */
export const MAX_UNIT_AMENITIES = 30;

/** An amenity as installed in one warehouse. */
export interface WarehouseAmenityView {
  amenityId: string;
  code: string;
  name: string;
  quantity: number;
  note: string | null;
}

/** One entry of a "replace the amenities of this warehouse" request. */
export interface UnitAmenityInput {
  amenityId: string;
  quantity: number;
  note?: string | null;
}

/**
 * Keeps units that carry every amenity in `:amenityIds`. A correlated count over the primary key
 * instead of a join: the listing paginates with `getCount`, which stays exact only while no join
 * multiplies rows. Callers must pass distinct ids for `:amenityCount` to match.
 */
export const HAS_ALL_AMENITIES_SQL =
  '(SELECT COUNT(*) FROM storage_unit_amenities sua ' +
  'WHERE sua.storage_unit_id = unit.id AND sua.amenity_id IN (:...amenityIds)) = :amenityCount';

/** Amenities of many warehouses in one query; ids without any amenity map to `[]`. */
export async function loadUnitAmenities(
  manager: EntityManager,
  unitIds: string[],
): Promise<Map<string, WarehouseAmenityView[]>> {
  const byUnit = new Map<string, WarehouseAmenityView[]>(unitIds.map((id) => [id, []]));
  if (unitIds.length === 0) return byUnit;
  const rows = await manager
    .createQueryBuilder(StorageUnitAmenity, 'sua')
    .innerJoinAndSelect('sua.amenity', 'amenity')
    .where('sua.storageUnitId IN (:...unitIds)', { unitIds })
    .orderBy('amenity.sortOrder', 'ASC')
    .addOrderBy('amenity.name', 'ASC')
    .getMany();
  for (const row of rows) {
    byUnit.get(row.storageUnitId)?.push({
      amenityId: row.amenityId,
      code: row.amenity?.code ?? '',
      name: row.amenity?.name ?? '',
      quantity: row.quantity,
      note: row.note ?? null,
    });
  }
  return byUnit;
}

/**
 * Replaces the whole amenity list of a warehouse. Runs inside the caller's transaction, which
 * already holds the unit row lock, so concurrent edits of one warehouse cannot interleave the
 * delete and insert. A retired amenity may stay on a warehouse that already carries it (so the
 * warehouse can still be saved) but cannot be newly attached.
 */
export async function replaceUnitAmenities(
  manager: EntityManager,
  unitId: string,
  items: UnitAmenityInput[],
): Promise<void> {
  const ids = items.map((item) => item.amenityId);
  // Sequential on purpose: the transaction owns a single connection, and node-postgres deprecates overlapping queries on one client.
  const amenities = ids.length === 0 ? [] : await manager.find(Amenity, { where: { id: In(ids) } });
  const attached =
    ids.length === 0
      ? []
      : await manager.find(StorageUnitAmenity, { where: { storageUnitId: unitId } });
  const known = new Map(amenities.map((amenity) => [amenity.id, amenity]));
  const alreadyAttached = new Set(attached.map((row) => row.amenityId));
  for (const item of items) {
    const amenity = known.get(item.amenityId);
    if (!amenity) {
      throw fieldValidationError(
        'amenities',
        'notFound',
        `Amenity ${item.amenityId} does not exist`,
      );
    }
    if (!amenity.isActive && !alreadyAttached.has(amenity.id)) {
      throw fieldValidationError(
        'amenities',
        'inactive',
        `Amenity ${amenity.code} is no longer in use`,
      );
    }
  }

  await manager.delete(StorageUnitAmenity, { storageUnitId: unitId });
  if (items.length === 0) return;
  await manager.insert(
    StorageUnitAmenity,
    items.map((item) => ({
      storageUnitId: unitId,
      amenityId: item.amenityId,
      quantity: item.quantity,
      note: item.note?.trim() || null,
    })),
  );
}
