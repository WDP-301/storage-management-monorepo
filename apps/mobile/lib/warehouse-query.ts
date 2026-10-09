/**
 * Browse filter model and `GET /warehouses` query building.
 *
 * Kept free of runtime imports so `warehouse-query.test.cjs` can transpile and load it standalone.
 * The API treats every min/max bound as inclusive, so adjacent presets share their boundary value.
 */

import type { BrowseCriteria, WarehouseSort } from '../src/types/customer';
import type { Warehouse } from '../src/types/storage-api';

export const MAX_WAREHOUSES_PER_BOOKING = 4;
export const PAGE_SIZE = 20;
/** Highest `limit` the API accepts. */
export const FACET_LIMIT = 100;

export type RangePreset = { key: string; label: string; min?: number; max?: number };

export const AREA_PRESETS: readonly RangePreset[] = [
  { key: 'any', label: 'Tất cả' },
  { key: 'xs', label: '≤ 10 m²', max: 10 },
  { key: 's', label: '10 – 30 m²', min: 10, max: 30 },
  { key: 'm', label: '30 – 80 m²', min: 30, max: 80 },
  { key: 'l', label: '> 80 m²', min: 80 },
];

export const VOLUME_PRESETS: readonly RangePreset[] = [
  { key: 'any', label: 'Tất cả' },
  { key: 'xs', label: '≤ 30 m³', max: 30 },
  { key: 's', label: '30 – 100 m³', min: 30, max: 100 },
  { key: 'm', label: '100 – 300 m³', min: 100, max: 300 },
  { key: 'l', label: '> 300 m³', min: 300 },
];

export const PRICE_PRESETS: readonly RangePreset[] = [
  { key: 'any', label: 'Tất cả' },
  { key: 'xs', label: '≤ 3 triệu', max: 3_000_000 },
  { key: 's', label: '3 – 6 triệu', min: 3_000_000, max: 6_000_000 },
  { key: 'm', label: '6 – 12 triệu', min: 6_000_000, max: 12_000_000 },
  { key: 'l', label: '> 12 triệu', min: 12_000_000 },
];

export const SORT_OPTIONS: readonly { key: WarehouseSort; label: string }[] = [
  { key: 'price_asc', label: 'Giá thấp → cao' },
  { key: 'price_desc', label: 'Giá cao → thấp' },
  { key: 'area_asc', label: 'Diện tích nhỏ → lớn' },
  { key: 'area_desc', label: 'Diện tích lớn → nhỏ' },
  { key: 'newest', label: 'Mới nhất' },
];

export const DEFAULT_BROWSE_CRITERIA: BrowseCriteria = {
  provinceCode: null,
  wardCode: null,
  areaPreset: 'any',
  volumePreset: 'any',
  pricePreset: 'any',
  sort: 'price_asc',
};

function findPreset(presets: readonly RangePreset[], key: string): RangePreset | undefined {
  return presets.find((preset) => preset.key === key);
}

/** Query string for `GET /warehouses` (no leading `?`). Unset filters are omitted. */
export function buildWarehouseQuery(criteria: BrowseCriteria, page = 1, limit = PAGE_SIZE): string {
  const params: [string, string | number][] = [];
  if (criteria.provinceCode) params.push(['provinceCode', criteria.provinceCode]);
  if (criteria.wardCode) params.push(['wardCode', criteria.wardCode]);

  const ranges: [string, string, readonly RangePreset[]][] = [
    ['Area', criteria.areaPreset, AREA_PRESETS],
    ['Volume', criteria.volumePreset, VOLUME_PRESETS],
    ['Price', criteria.pricePreset, PRICE_PRESETS],
  ];
  for (const [name, key, presets] of ranges) {
    const preset = findPreset(presets, key);
    if (preset?.min !== undefined) params.push([`min${name}`, preset.min]);
    if (preset?.max !== undefined) params.push([`max${name}`, preset.max]);
  }

  params.push(['sort', criteria.sort], ['page', page], ['limit', limit]);
  return params.map(([name, value]) => `${name}=${encodeURIComponent(String(value))}`).join('&');
}

function inRange(value: number | null, preset: RangePreset | undefined): boolean {
  if (!preset || (preset.min === undefined && preset.max === undefined)) return true;
  if (value === null) return false;
  return (
    (preset.min === undefined || value >= preset.min) &&
    (preset.max === undefined || value <= preset.max)
  );
}

/**
 * Client-side mirror of the server filters. Only used for `/places/nearby`, which returns every
 * warehouse in range and takes no filter params.
 */
export function matchesCriteria(warehouse: Warehouse, criteria: BrowseCriteria): boolean {
  if (criteria.provinceCode && warehouse.provinceCode !== criteria.provinceCode) return false;
  if (criteria.wardCode && warehouse.wardCode !== criteria.wardCode) return false;
  return (
    inRange(warehouse.areaM2, findPreset(AREA_PRESETS, criteria.areaPreset)) &&
    inRange(warehouse.volumeM3, findPreset(VOLUME_PRESETS, criteria.volumePreset)) &&
    inRange(warehouse.monthlyPrice, findPreset(PRICE_PRESETS, criteria.pricePreset))
  );
}

export function countActiveFilters(criteria: BrowseCriteria): number {
  return [
    criteria.provinceCode !== null,
    criteria.wardCode !== null,
    criteria.areaPreset !== 'any',
    criteria.volumePreset !== 'any',
    criteria.pricePreset !== 'any',
  ].filter(Boolean).length;
}

/** Clears the narrowing filters while keeping the chosen sort order. */
export function clearFilters(criteria: BrowseCriteria): BrowseCriteria {
  return { ...DEFAULT_BROWSE_CRITERIA, sort: criteria.sort };
}

/** Deposit in VND: monthly price times the deposit level that is actually charged. */
export function warehouseDeposit(
  warehouse: Pick<Warehouse, 'monthlyPrice' | 'effectiveDepositMonths'>,
) {
  return warehouse.monthlyPrice * warehouse.effectiveDepositMonths;
}

/** Items for `POST /bookings`: each warehouse is booked through its hidden unit id. */
export function buildBookingItems(
  warehouses: readonly Pick<Warehouse, 'unitId'>[],
  startDate: string,
  rentalMonths: number,
) {
  return warehouses.map((warehouse) => ({
    storageUnitId: warehouse.unitId,
    // Noon UTC keeps the selected calendar day stable for the API's date validation.
    requestedStartAt: `${startDate}T12:00:00.000Z`,
    rentalMonths,
  }));
}
