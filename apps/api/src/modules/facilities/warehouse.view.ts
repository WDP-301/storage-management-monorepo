import type { StorageUnit } from '@entities/storage-unit.entity';
import type { StorageUnitStatus } from '@storage/types';

/**
 * A warehouse as clients see it: the storage unit with its owning facility (branch) summary.
 * `id` is the storage unit id — what bookings, change requests and tours reference.
 */
export interface WarehouseView {
  id: string;
  facility: { id: string; code: string; name: string };
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
    id: unit.id,
    facility: { id: facility.id, code: facility.code, name: facility.name },
    code: unit.code,
    name: unit.name,
    addressLine: unit.addressLine,
    wardCode: unit.wardCode ?? null,
    provinceCode: unit.provinceCode ?? null,
    latitude: Number(unit.latitude),
    longitude: Number(unit.longitude),
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
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
  };
}
