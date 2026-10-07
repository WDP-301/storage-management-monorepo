import { formatArea, formatNumber } from '../../../lib/format-vi';
import type { FacilityOffer, UnitOffer } from '../../types/customer';
import type { ApiStorageUnit } from '../../types/storage-api';

/**
 * Maps `GET /storage-units` rows onto the shapes the browse UI renders.
 *
 * Two API details drive this file:
 * - Postgres `decimal` columns arrive as strings, so every numeric field is coerced here once.
 * - `facility` and `unitType` come from left joins and are `null` when the related row was
 *   soft-deleted, while the unit itself still shows up. Such units are dropped.
 */

/** Compared as a literal so the app does not pull in the compiled `@storage/types` runtime. */
const ACTIVE_FACILITY_STATUS = 'ACTIVE';

function toNumber(value: string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Returns `null` for units the customer must not see (missing or inactive facility/unit type). */
export function toUnitOffer(
  unit: ApiStorageUnit,
  provinceNames: ReadonlyMap<string, string>,
): UnitOffer | null {
  const { facility, unitType } = unit;
  if (!facility || !unitType) return null;
  // The join does not filter on facility status, so units of a closed facility would leak through.
  if (facility.status !== ACTIVE_FACILITY_STATUS) return null;

  const monthlyPrice = toNumber(unitType.monthlyPrice);
  const areaM2 = toNumber(unit.areaM2);

  return {
    id: unit.id,
    facilityId: unit.facilityId,
    facility: facility.name,
    address: buildAddress(facility.addressLine, facility.provinceCode, provinceNames),
    code: unit.code,
    zone: unit.zone || '—',
    areaM2,
    size: formatArea(areaM2),
    dimensions: buildDimensions(unitType.widthM, unitType.lengthM, unitType.heightM),
    monthlyPrice,
    deposit: monthlyPrice * toNumber(unitType.defaultDepositMonths),
    unitTypeId: unit.unitTypeId,
    unitTypeName: unitType.name,
    provinceCode: facility.provinceCode ?? null,
    wardCode: facility.wardCode ?? null,
    notes: unit.notes ?? null,
    latitude: toNumber(facility.latitude),
    longitude: toNumber(facility.longitude),
  };
}

/**
 * Groups mappable units by facility, cheapest unit first within each facility and cheapest
 * facility first. The "recommended" mode slices the first N units of a facility, so this ordering
 * is what makes that slice a sensible proposal rather than an alphabetical accident.
 */
export function groupUnitsByFacility(
  units: readonly ApiStorageUnit[],
  provinceNames: ReadonlyMap<string, string>,
): FacilityOffer[] {
  const facilities = new Map<string, FacilityOffer>();

  for (const unit of units) {
    const offer = toUnitOffer(unit, provinceNames);
    if (!offer) continue;

    const existing = facilities.get(offer.facilityId);
    if (existing) {
      existing.units.push(offer);
      continue;
    }

    facilities.set(offer.facilityId, {
      id: offer.facilityId,
      name: offer.facility,
      address: offer.address,
      provinceCode: offer.provinceCode,
      wardCode: offer.wardCode,
      // Already coerced to numbers by `toUnitOffer`; every unit of a facility carries the same pair.
      latitude: offer.latitude,
      longitude: offer.longitude,
      units: [offer],
    });
  }

  const grouped = [...facilities.values()];
  for (const facility of grouped) {
    facility.units.sort((a, b) => a.monthlyPrice - b.monthlyPrice);
  }

  return grouped.sort((a, b) => (a.units[0]?.monthlyPrice ?? 0) - (b.units[0]?.monthlyPrice ?? 0));
}

function buildAddress(
  addressLine: string,
  provinceCode: string | null | undefined,
  provinceNames: ReadonlyMap<string, string>,
): string {
  const province = provinceCode ? provinceNames.get(provinceCode) : undefined;
  return province ? `${addressLine}, ${province}` : addressLine;
}

function buildDimensions(
  widthM: string,
  lengthM: string,
  heightM: string | null | undefined,
): string {
  const footprint = `${formatNumber(toNumber(widthM))} × ${formatNumber(toNumber(lengthM))} m`;
  return heightM ? `${footprint} · cao ${formatNumber(toNumber(heightM))} m` : footprint;
}
