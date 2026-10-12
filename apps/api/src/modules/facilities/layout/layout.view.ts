import type { LayoutElement, ShelfLayout } from '@entities/shelf-layout.entity';
import { StorageUnitStatus } from '@storage/types';
import type { WarehouseView } from '../warehouse.view';

export interface PlacedShelfView {
  shelf: WarehouseView;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

export interface LayoutView {
  warehouseId: string;
  layout: {
    rows: number;
    cols: number;
    version: number;
    updatedAt: Date;
    elements: LayoutElement[];
    /** Back office only. */
    updatedBy?: string | null;
  } | null;
  /** Placed shelves that still exist, in any status: a retired shelf still stands on the floor. */
  placed: PlacedShelfView[];
  /** Live shelves without a spot on the plan; customers do not see retired ones. */
  unplaced: WarehouseView[];
}

/**
 * `shelves` is every live shelf of the warehouse, retired included. A placement whose shelf is
 * gone (soft-deleted after the plan was saved) is dropped silently rather than failing the read.
 */
export function toLayoutView(
  warehouseId: string,
  layout: ShelfLayout | null,
  shelves: WarehouseView[],
  options: { backOffice: boolean },
): LayoutView {
  const byId = new Map(shelves.map((shelf) => [shelf.id, shelf]));
  const placed: PlacedShelfView[] = [];
  for (const { shelfId, row, col, rowSpan, colSpan } of layout?.placements ?? []) {
    const shelf = byId.get(shelfId);
    if (shelf) placed.push({ shelf, row, col, rowSpan, colSpan });
  }
  const placedIds = new Set(placed.map((entry) => entry.shelf.id));
  const unplaced = shelves.filter(
    (shelf) =>
      !placedIds.has(shelf.id) &&
      (options.backOffice || shelf.status !== StorageUnitStatus.INACTIVE),
  );
  return {
    warehouseId,
    layout: layout && {
      rows: layout.rows,
      cols: layout.cols,
      version: layout.version,
      updatedAt: layout.updatedAt,
      elements: layout.elements,
      ...(options.backOffice ? { updatedBy: layout.updatedBy } : {}),
    },
    placed,
    unplaced,
  };
}
