import type { Warehouse, WarehouseStatus } from '../../types/warehouse';

export type MapStatusGroup =
  | 'available'
  | 'booked'
  | 'rented'
  | 'pending'
  | 'maintenance'
  | 'inactive';

/** One marker colour per stage a manager acts on: free, deposit paid, rented, in transition. */
export const MAP_STATUS_GROUPS: Record<MapStatusGroup, { label: string; color: string }> = {
  available: { label: 'Còn trống', color: '#16a34a' },
  booked: { label: 'Đã cọc', color: '#7c3aed' },
  rented: { label: 'Đang thuê', color: '#2563eb' },
  pending: { label: 'Giữ chỗ / chờ kiểm tra', color: '#f59e0b' },
  maintenance: { label: 'Bảo trì', color: '#dc2626' },
  inactive: { label: 'Ngưng hoạt động', color: '#6b7280' },
};

const STATUS_GROUP: Record<WarehouseStatus, MapStatusGroup> = {
  AVAILABLE: 'available',
  // A unit becomes BOOKED once its deposit is paid.
  BOOKED: 'booked',
  RENTED: 'rented',
  HELD: 'pending',
  PENDING_INSPECTION: 'pending',
  MAINTENANCE: 'maintenance',
  INACTIVE: 'inactive',
};

export const mapStatusGroup = (status: WarehouseStatus): MapStatusGroup => STATUS_GROUP[status];

export function countByMapStatus(
  warehouses: readonly Pick<Warehouse, 'status'>[],
): Record<MapStatusGroup, number> {
  const counts: Record<MapStatusGroup, number> = {
    available: 0,
    booked: 0,
    rented: 0,
    pending: 0,
    maintenance: 0,
    inactive: 0,
  };
  for (const { status } of warehouses) counts[mapStatusGroup(status)] += 1;
  return counts;
}
