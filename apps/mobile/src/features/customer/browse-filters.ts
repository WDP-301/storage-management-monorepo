import type { AreaPresetKey, BrowseCriteria, FacilityOffer, UnitOffer } from '../../types/customer';
import type { LocationOption } from './location-options';

/**
 * Client-side browse filtering.
 *
 * `GET /storage-units` only accepts `facilityId` / `unitTypeId` / `page` / `limit`, so narrowing by
 * area, price and administrative area happens here over the full fetched set.
 */

type AreaPreset = {
  key: AreaPresetKey;
  label: string;
  /** Exclusive lower bound in m². */
  min?: number;
  /** Inclusive upper bound in m². */
  max?: number;
};

export const AREA_PRESETS: readonly AreaPreset[] = [
  { key: 'any', label: 'Tất cả' },
  { key: 'small', label: '≤ 3 m²', max: 3 },
  { key: 'medium', label: '3 – 6 m²', min: 3, max: 6 },
  { key: 'large', label: '> 6 m²', min: 6 },
];

export const PRICE_PRESETS: readonly { label: string; maxMonthlyPrice: number | null }[] = [
  { label: 'Tất cả', maxMonthlyPrice: null },
  { label: '≤ 2 triệu', maxMonthlyPrice: 2_000_000 },
  { label: '≤ 3 triệu', maxMonthlyPrice: 3_000_000 },
  { label: '≤ 5 triệu', maxMonthlyPrice: 5_000_000 },
];

export const DURATION_PRESETS: readonly number[] = [3, 6, 12];

export const MAX_UNITS_PER_BOOKING = 4;

export const DEFAULT_BROWSE_CRITERIA: BrowseCriteria = {
  provinceCode: null,
  wardCode: null,
  areaPreset: 'any',
  maxMonthlyPrice: null,
  requestedQuantity: 2,
  durationMonths: 3,
};

/**
 * How many narrowing filters are active. Quantity and duration are excluded — they always hold a
 * value, so counting them would leave the badge permanently lit.
 */
export function countActiveFilters(criteria: BrowseCriteria): number {
  return [
    criteria.provinceCode !== null,
    criteria.wardCode !== null,
    criteria.areaPreset !== DEFAULT_BROWSE_CRITERIA.areaPreset,
    criteria.maxMonthlyPrice !== DEFAULT_BROWSE_CRITERIA.maxMonthlyPrice,
  ].filter(Boolean).length;
}

/** Clears the narrowing filters while keeping the booking terms the customer chose. */
export function clearFilters(criteria: BrowseCriteria): BrowseCriteria {
  return {
    ...criteria,
    provinceCode: DEFAULT_BROWSE_CRITERIA.provinceCode,
    wardCode: DEFAULT_BROWSE_CRITERIA.wardCode,
    areaPreset: DEFAULT_BROWSE_CRITERIA.areaPreset,
    maxMonthlyPrice: DEFAULT_BROWSE_CRITERIA.maxMonthlyPrice,
  };
}

/** Short labels of the active filters, for the summary line under the filter button. */
export function describeActiveFilters(
  criteria: BrowseCriteria,
  provinceOptions: readonly LocationOption[],
  wardOptions: readonly LocationOption[],
): string[] {
  const labels: string[] = [];

  const ward = wardOptions.find((option) => option.code === criteria.wardCode);
  const province = provinceOptions.find((option) => option.code === criteria.provinceCode);
  // The ward already implies its province, so only the narrower one is worth showing.
  if (ward) labels.push(ward.name);
  else if (province) labels.push(province.name);

  const area = AREA_PRESETS.find((preset) => preset.key === criteria.areaPreset);
  if (area && area.key !== DEFAULT_BROWSE_CRITERIA.areaPreset) labels.push(area.label);

  const price = PRICE_PRESETS.find((preset) => preset.maxMonthlyPrice === criteria.maxMonthlyPrice);
  if (price && price.maxMonthlyPrice !== null) labels.push(price.label);

  return labels;
}

/** Keeps only facilities and units matching the criteria; empty facilities are dropped. */
export function applyBrowseFilters(
  facilities: readonly FacilityOffer[],
  criteria: BrowseCriteria,
): FacilityOffer[] {
  const areaPreset = AREA_PRESETS.find((preset) => preset.key === criteria.areaPreset);

  return facilities
    .filter((facility) => matchesLocation(facility, criteria))
    .map((facility) => ({
      ...facility,
      units: facility.units.filter(
        (unit) => matchesArea(unit, areaPreset) && matchesPrice(unit, criteria.maxMonthlyPrice),
      ),
    }))
    .filter((facility) => facility.units.length > 0);
}

/**
 * How many units each area preset would yield, with the other filters left in place.
 *
 * Fixed buckets do not know the real catalogue: a deployment whose units are all 3 m² would still
 * offer a "> 6 m²" chip leading to an empty list. Counting each bucket lets the card label the
 * chips and hide the dead ones.
 */
export function countAreaPresetMatches(
  facilities: readonly FacilityOffer[],
  criteria: BrowseCriteria,
): ReadonlyMap<AreaPresetKey, number> {
  return new Map(
    AREA_PRESETS.map((preset) => [
      preset.key,
      countUnits(facilities, { ...criteria, areaPreset: preset.key }),
    ]),
  );
}

/** Same faceted count for the budget buckets, keyed by the preset's `maxMonthlyPrice`. */
export function countPricePresetMatches(
  facilities: readonly FacilityOffer[],
  criteria: BrowseCriteria,
): ReadonlyMap<number | null, number> {
  return new Map(
    PRICE_PRESETS.map((preset) => [
      preset.maxMonthlyPrice,
      countUnits(facilities, { ...criteria, maxMonthlyPrice: preset.maxMonthlyPrice }),
    ]),
  );
}

function countUnits(facilities: readonly FacilityOffer[], criteria: BrowseCriteria): number {
  return applyBrowseFilters(facilities, criteria).reduce(
    (total, facility) => total + facility.units.length,
    0,
  );
}

function matchesLocation(facility: FacilityOffer, criteria: BrowseCriteria): boolean {
  if (criteria.provinceCode && facility.provinceCode !== criteria.provinceCode) return false;
  if (criteria.wardCode && facility.wardCode !== criteria.wardCode) return false;
  return true;
}

function matchesArea(unit: UnitOffer, preset: AreaPreset | undefined): boolean {
  if (!preset) return true;
  if (preset.min !== undefined && unit.areaM2 <= preset.min) return false;
  if (preset.max !== undefined && unit.areaM2 > preset.max) return false;
  return true;
}

function matchesPrice(unit: UnitOffer, maxMonthlyPrice: number | null): boolean {
  return maxMonthlyPrice === null || unit.monthlyPrice <= maxMonthlyPrice;
}
