import type { StorageUnit } from '@entities/storage-unit.entity';
import type { StorageUnitStatus } from '@storage/types';

/**
 * A standalone warehouse as clients see it: the facility (identity, address, coordinates)
 * and its single unit (size, price, deposit, status) flattened into one record.
 * `id` is the facility id; `unitId` is what bookings reference.
 */
export interface WarehouseView {
  id: string;
  unitId: string;
  code: string;
  name: string;
  addressLine: string;
  wardCode: string | null;
  provinceCode: string | null;
  latitude: number;
  longitude: number;
  widthM: number;
  lengthM: number;
  heightM: number | null;
  areaM2: number;
  volumeM3: number | null;
  monthlyPrice: number;
  /** The warehouse's own deposit level; null follows the system-wide setting. */
  depositMonths: number | null;
  /** Deposit months actually charged. */
  effectiveDepositMonths: number;
  status: StorageUnitStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const toNumberOrNull = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

/** `unit.facility` must be loaded. Postgres decimals arrive as strings and are normalised. */
export function toWarehouseView(unit: StorageUnit, effectiveDepositMonths: number): WarehouseView {
  const { facility } = unit;
  return {
    id: facility.id,
    unitId: unit.id,
    code: facility.code,
    name: facility.name,
    addressLine: facility.addressLine,
    wardCode: facility.wardCode ?? null,
    provinceCode: facility.provinceCode ?? null,
    latitude: Number(facility.latitude),
    longitude: Number(facility.longitude),
    widthM: Number(unit.widthM),
    lengthM: Number(unit.lengthM),
    heightM: toNumberOrNull(unit.heightM),
    areaM2: Number(unit.areaM2),
    volumeM3: toNumberOrNull(unit.volumeM3),
    monthlyPrice: Number(unit.monthlyPrice),
    depositMonths: unit.depositMonths ?? null,
    effectiveDepositMonths,
    status: unit.status,
    notes: unit.notes ?? null,
    createdAt: facility.createdAt,
    updatedAt: unit.updatedAt > facility.updatedAt ? unit.updatedAt : facility.updatedAt,
  };
}
