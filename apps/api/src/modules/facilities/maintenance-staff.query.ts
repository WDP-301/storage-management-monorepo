import type { EntityManager } from 'typeorm';
import type { WarehouseMaintenanceStaff } from './warehouse.view';

/**
 * Who checks each unit: the staff member assigned to the unit's latest MAINTENANCE inspection.
 * Those inspections live on the cancelled old contract of a unit change, so contract status is not
 * filtered. A unit put on maintenance by hand has no inspection and is left out of the map.
 */
export async function loadMaintenanceStaff(
  manager: EntityManager,
  unitIds: string[],
): Promise<Map<string, WarehouseMaintenanceStaff>> {
  if (unitIds.length === 0) return new Map();
  const rows: { unitId: string; id: string; fullName: string }[] = await manager.query(
    `SELECT DISTINCT ON (su.id) su.id AS "unitId", u.id AS "id", u.full_name AS "fullName"
       FROM inspections i
       JOIN contracts c ON c.id = i.contract_id
       JOIN booking_items bi ON bi.id = c.booking_item_id
       JOIN storage_units su ON su.id = bi.storage_unit_id
       JOIN app_users u ON u.id = i.inspected_by
      WHERE i.type = 'MAINTENANCE' AND su.id = ANY($1::uuid[])
      ORDER BY su.id, i.created_at DESC, i.id DESC`,
    [unitIds],
  );
  return new Map(rows.map((row) => [row.unitId, { id: row.id, fullName: row.fullName }]));
}
