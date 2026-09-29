import type { FacilityOffer } from '../../types/customer';

export type LocationOption = { code: string; name: string };

/**
 * Filter options are derived from the facilities that actually have available units, not from the
 * full administrative list — otherwise the picker would offer 34 provinces for two warehouses.
 * The `/locations` endpoints are only consulted to turn codes into names.
 */

export function buildProvinceOptions(
  facilities: readonly FacilityOffer[],
  provinces: readonly { code: string; name: string }[],
): LocationOption[] {
  const names = new Map(provinces.map((province) => [province.code, province.name]));
  return toSortedOptions(
    facilities.map((facility) => facility.provinceCode),
    names,
  );
}

export function buildWardOptions(
  facilities: readonly FacilityOffer[],
  provinceCode: string | null,
  wardNames: ReadonlyMap<string, string>,
): LocationOption[] {
  if (!provinceCode) return [];

  return toSortedOptions(
    facilities
      .filter((facility) => facility.provinceCode === provinceCode)
      .map((facility) => facility.wardCode),
    wardNames,
  );
}

/** Dedupes codes, resolves names (falling back to the raw code) and sorts them for display. */
function toSortedOptions(
  codes: readonly (string | null)[],
  names: ReadonlyMap<string, string>,
): LocationOption[] {
  const unique = new Set(codes.filter((code): code is string => Boolean(code)));

  return [...unique]
    .map((code) => ({ code, name: names.get(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}
