import type { StorageUnit, WarehouseImage } from '@entities/storage-unit.entity';
import type { StorageUnitKind, StorageUnitStatus } from '@storage/types';

/** A stored photo plus a presigned GET link; links expire, so clients refetch rather than keep them. */
export interface WarehouseImageView extends WarehouseImage {
  url: string;
}

/** Live-shelf rollup of a shelf warehouse; min/max cover AVAILABLE shelves only. */
export interface ShelfSummary {
  total: number;
  available: number;
  minMonthlyPrice: number | null;
  statusCounts: Partial<Record<StorageUnitStatus, number>>;
  minAreaM2: number | null;
  maxAreaM2: number | null;
  minVolumeM3: number | null;
  maxVolumeM3: number | null;
}

/**
 * A warehouse as clients see it: the storage unit with its owning facility (branch) summary.
 * `id` is the storage unit id — what bookings, change requests and tours reference.
 */
export interface WarehouseView {
  id: string;
  facility: { id: string; code: string; name: string };
  kind: StorageUnitKind;
  parentId: string | null;
  /** The shelf warehouse holding this shelf; null for other kinds or when the relation is not loaded. */
  parent: { id: string; code: string; name: string } | null;
  /** Non-null for shelf warehouses only. */
  shelfSummary: ShelfSummary | null;
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
  /** Display order; the first one is the cover. */
  images: WarehouseImageView[];
  createdAt: Date;
  updatedAt: Date;
}

const toNumberOrNull = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

/** `unit.facility` must be loaded; `unit.parent` is read only when loaded. Postgres decimals arrive as strings and are normalised. */
export function toWarehouseView(
  unit: StorageUnit,
  effectiveDepositMonths: number,
  images: WarehouseImageView[] = [],
  shelfSummary: ShelfSummary | null = null,
): WarehouseView {
  const { facility, parent } = unit;
  return {
    id: unit.id,
    facility: { id: facility.id, code: facility.code, name: facility.name },
    kind: unit.kind,
    parentId: unit.parentId ?? null,
    parent: parent ? { id: parent.id, code: parent.code, name: parent.name } : null,
    shelfSummary,
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
    images,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
  };
}
