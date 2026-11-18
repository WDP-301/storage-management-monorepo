/** Grouping of shelf-change destinations by the shelf warehouse (floor plan) that holds them. */

export type ShelfWarehouseContents<W extends { id: string }> = {
  warehouse: W;
  shelfIds: readonly string[];
};

export type ShelfOptionGroup<W> = {
  warehouse: W;
  /** Destination shelves (option unit ids) inside this warehouse, in option order. */
  optionIds: string[];
};

/**
 * Keeps the warehouses that hold at least one destination option, the customer's current one
 * first, and returns the options found in none of them so they can still be listed.
 */
export function groupShelfOptions<W extends { id: string }, O extends { unit: { id: string } }>(
  warehouses: readonly ShelfWarehouseContents<W>[],
  options: readonly O[],
  currentWarehouseId: string | null,
): { groups: ShelfOptionGroup<W>[]; orphans: O[] } {
  const owner = new Map<string, string>();
  const unique: ShelfWarehouseContents<W>[] = [];
  for (const entry of warehouses) {
    if (unique.some((item) => item.warehouse.id === entry.warehouse.id)) continue;
    unique.push(entry);
    for (const shelfId of entry.shelfIds) {
      if (!owner.has(shelfId)) owner.set(shelfId, entry.warehouse.id);
    }
  }

  const byWarehouse = new Map<string, string[]>();
  const orphans: O[] = [];
  for (const option of options) {
    const warehouseId = owner.get(option.unit.id);
    if (!warehouseId) {
      orphans.push(option);
      continue;
    }
    const ids = byWarehouse.get(warehouseId) ?? [];
    ids.push(option.unit.id);
    byWarehouse.set(warehouseId, ids);
  }

  const groups = unique
    .filter((entry) => byWarehouse.has(entry.warehouse.id))
    .map((entry) => ({
      warehouse: entry.warehouse,
      optionIds: byWarehouse.get(entry.warehouse.id) ?? [],
    }));
  const currentIndex = groups.findIndex((group) => group.warehouse.id === currentWarehouseId);
  if (currentIndex > 0) groups.unshift(...groups.splice(currentIndex, 1));
  return { groups, orphans };
}

/** "+50.000 ₫/tháng"-style sign for a monthly or deposit difference; '' when there is none. */
export function signedDifference(value: number, format: (amount: number) => string): string {
  if (value === 0) return '';
  return `${value > 0 ? '+' : '−'}${format(Math.abs(value))}`;
}
