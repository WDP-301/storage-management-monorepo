import type { Warehouse } from '../src/types/storage-api';

export const isShelfWarehouse = (warehouse: Warehouse) => warehouse.kind === 'SHELF_WAREHOUSE';
export const isRentable = (warehouse: Warehouse) =>
  warehouse.kind !== 'SHELF_WAREHOUSE' && warehouse.status === 'AVAILABLE';

export function displayMonthlyPrice(warehouse: Warehouse): number | null {
  return isShelfWarehouse(warehouse)
    ? (warehouse.shelfSummary?.minMonthlyPrice ?? null)
    : warehouse.monthlyPrice;
}

export function rentalName(warehouse: Warehouse): string {
  if (warehouse.kind === 'SHELF' && warehouse.parent) {
    if (warehouse.name.toLowerCase().includes(warehouse.parent.name.toLowerCase())) {
      return warehouse.name;
    }
    return `${warehouse.name} · ${warehouse.parent.name}`;
  }
  return warehouse.name;
}
