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
  return warehouse.kind === 'SHELF' && warehouse.parent
    ? `${warehouse.name} · ${warehouse.parent.name}`
    : warehouse.name;
}
