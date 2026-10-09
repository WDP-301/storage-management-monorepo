import type { Warehouse, WarehouseStatus } from '../../types/warehouse';

export type MapStatusGroup = 'available' | 'occupied' | 'maintenance' | 'inactive';

/** Marker colours group statuses the way the KPI cards do, so the map reads at a glance. */
export const MAP_STATUS_GROUPS: Record<MapStatusGroup, { label: string; color: string }> = {
  available: { label: 'Còn trống', color: '#16a34a' },
  occupied: { label: 'Có khách', color: '#2658b8' },
  maintenance: { label: 'Bảo trì', color: '#dc2626' },
  inactive: { label: 'Ngưng hoạt động', color: '#6b7280' },
};

const STATUS_GROUP: Record<WarehouseStatus, MapStatusGroup> = {
  AVAILABLE: 'available',
  HELD: 'occupied',
  BOOKED: 'occupied',
  RENTED: 'occupied',
  PENDING_INSPECTION: 'occupied',
  MAINTENANCE: 'maintenance',
  INACTIVE: 'inactive',
};

export const mapStatusGroup = (status: WarehouseStatus): MapStatusGroup => STATUS_GROUP[status];

export function countByMapStatus(
  warehouses: readonly Pick<Warehouse, 'status'>[],
): Record<MapStatusGroup, number> {
  const counts: Record<MapStatusGroup, number> = {
    available: 0,
    occupied: 0,
    maintenance: 0,
    inactive: 0,
  };
  for (const { status } of warehouses) counts[mapStatusGroup(status)] += 1;
  return counts;
}
