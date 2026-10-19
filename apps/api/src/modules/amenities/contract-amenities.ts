import type { ContractAmenity } from '@entities/contract.entity';
import type { EntityManager } from 'typeorm';

interface AmenityRow {
  amenityId: string;
  code: string;
  name: string;
  quantity: number | string;
  note: string | null;
}

/**
 * Amenities to freeze into a contract for `storageUnitId`. A shelf carries no amenities of its
 * own (only the shelf warehouse does, and only SHELF units have a parent), so it resolves to its
 * parent warehouse via COALESCE(parent_id, id). Retired amenities still attached are included.
 *
 * This must stay ONE statement: under READ COMMITTED a single statement sees one MVCC snapshot,
 * and `replaceUnitAmenities` deletes and re-inserts inside one transaction, so the read sees the
 * list entirely before or entirely after an edit. Nothing on the read side takes a lock, so
 * splitting this into "find the parent" then "load amenities" could mix two versions.
 */
export async function snapshotUnitAmenities(
  manager: EntityManager,
  storageUnitId: string,
): Promise<ContractAmenity[]> {
  const rows: AmenityRow[] = await manager.query(
    `SELECT a.id AS "amenityId", a.code, a.name, sua.quantity, sua.note
       FROM storage_units u
       JOIN storage_unit_amenities sua ON sua.storage_unit_id = COALESCE(u.parent_id, u.id)
       JOIN amenities a ON a.id = sua.amenity_id
      WHERE u.id = $1
      ORDER BY a.sort_order, a.name`,
    [storageUnitId],
  );
  return rows.map((row) => ({
    amenityId: row.amenityId,
    code: row.code,
    name: row.name,
    quantity: Number(row.quantity),
    note: row.note ?? null,
  }));
}
