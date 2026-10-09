import type { Warehouse } from '../../types/storage-api';

export type LocationOption = { code: string; name: string; count: number };

/**
 * Filter options are derived from warehouses that actually have stock, not from the full
 * administrative list — otherwise the picker would offer 34 provinces for a handful of warehouses.
 * The `/locations` endpoints are only consulted to turn codes into names.
 */

export function buildProvinceOptions(
  warehouses: readonly Warehouse[],
  provinces: readonly { code: string; name: string }[],
): LocationOption[] {
  const names = new Map(provinces.map((province) => [province.code, province.name]));
  return toSortedOptions(
    warehouses.map((warehouse) => warehouse.provinceCode),
    names,
  );
}

/** `warehouses` must already be scoped to `provinceCode` (see `listFacets`). */
export function buildWardOptions(
  warehouses: readonly Warehouse[],
  provinceCode: string | null,
  wardNames: ReadonlyMap<string, string>,
): LocationOption[] {
  if (!provinceCode) return [];
  return toSortedOptions(
    warehouses.filter((w) => w.provinceCode === provinceCode).map((w) => w.wardCode),
    wardNames,
  );
}

/** Counts codes, resolves names (falling back to the raw code) and sorts them for display. */
function toSortedOptions(
  codes: readonly (string | null)[],
  names: ReadonlyMap<string, string>,
): LocationOption[] {
  const counts = new Map<string, number>();
  for (const code of codes) {
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  return [...counts]
    .map(([code, count]) => ({ code, name: names.get(code) ?? code, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}
