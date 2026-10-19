import type { LayoutElementType, StorageUnitKind } from '@storage/types';
import type { WarehouseAmenity, WarehouseAmenityInput } from './amenity';

export type { LayoutElementType, StorageUnitKind };

export const WAREHOUSE_STATUSES = [
  'AVAILABLE',
  'HELD',
  'BOOKED',
  'RENTED',
  'PENDING_INSPECTION',
  'MAINTENANCE',
  'INACTIVE',
] as const;

export type WarehouseStatus = (typeof WAREHOUSE_STATUSES)[number];

/** Statuses an admin may set directly; the rest are driven by booking/contract flows. */
export type WarehouseIdleStatus = 'AVAILABLE' | 'MAINTENANCE' | 'INACTIVE';

export type WarehouseCreatableKind = 'SELF_STORAGE' | 'SHELF_WAREHOUSE';

export interface WarehouseFacility {
  id: string;
  code: string;
  name: string;
}

export interface WarehouseParentSummary {
  id: string;
  code: string;
  name: string;
}

/** Live-shelf rollup of a shelf warehouse; min/max cover AVAILABLE shelves only. */
export interface ShelfSummary {
  total: number;
  available: number;
  minMonthlyPrice: number | null;
  statusCounts: Partial<Record<WarehouseStatus, number>>;
  minAreaM2: number | null;
  maxAreaM2: number | null;
  minVolumeM3: number | null;
  maxVolumeM3: number | null;
}

/** A warehouse photo in the private bucket; `url` is a presigned link that expires. */
export interface WarehouseImage {
  fileKey: string;
  name: string;
  mimeType: string;
  size?: number;
  url?: string;
}

export interface Warehouse {
  id: string;
  facility: WarehouseFacility;
  kind?: StorageUnitKind;
  parentId?: string | null;
  parent?: WarehouseParentSummary | null;
  shelfSummary?: ShelfSummary | null;
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
  depositMonths: number | null;
  effectiveDepositMonths: number;
  status: WarehouseStatus;
  notes: string | null;
  /** Display order; the first one is the cover. */
  images: WarehouseImage[];
  /** Optional so older fixtures without amenities still type-check. */
  amenities?: WarehouseAmenity[];
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseListQuery {
  facilityId?: string;
  search?: string;
  status?: WarehouseStatus;
  provinceCode?: string;
  wardCode?: string;
  minArea?: number;
  maxArea?: number;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'area_asc' | 'area_desc';
  includeShelfWarehouses?: boolean;
  page?: number;
  limit?: number;
}

export interface WarehouseListResponse {
  warehouses: Warehouse[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface WarehouseInput {
  kind?: WarehouseCreatableKind;
  facilityId: string;
  code: string;
  name: string;
  addressLine: string;
  wardCode?: string;
  provinceCode?: string;
  latitude: number;
  longitude: number;
  widthM: number;
  lengthM: number;
  heightM: number;
  /** Omitted for SHELF_WAREHOUSE (priced per shelf). */
  monthlyPrice?: number;
  /** `null` falls back to the system default deposit level; omitted for SHELF_WAREHOUSE. */
  depositMonths?: number | null;
  notes?: string;
  status?: WarehouseIdleStatus;
  /** The full photo list; replaces the stored one. */
  images?: Omit<WarehouseImage, 'url'>[];
  /** The full amenity list; omitted leaves it unchanged, `[]` clears it. */
  amenities?: WarehouseAmenityInput[];
}

export interface ShelfCreateInput {
  code: string;
  name?: string;
  widthM: number;
  lengthM: number;
  heightM?: number;
  monthlyPrice: number;
  depositMonths?: number | null;
  notes?: string;
  status?: WarehouseIdleStatus;
}

export interface ShelfUpdateInput {
  code?: string;
  name?: string;
  widthM?: number;
  lengthM?: number;
  heightM?: number | null;
  monthlyPrice?: number;
  depositMonths?: number | null;
  notes?: string;
  status?: WarehouseIdleStatus;
}

export interface BulkCreateShelvesInput {
  prefix: string;
  from: number;
  to: number;
  pad?: number;
  widthM: number;
  lengthM: number;
  heightM?: number;
  monthlyPrice: number;
  depositMonths?: number | null;
}

export interface BulkCreateShelvesResult {
  created: number;
  codes: string[];
}

export interface LayoutRect {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

export interface LayoutElement extends LayoutRect {
  type: LayoutElementType;
  text?: string;
}

export interface ShelfPlacement extends LayoutRect {
  shelfId: string;
}

export interface PlacedShelfView extends LayoutRect {
  shelf: Warehouse;
}

export interface LayoutView {
  warehouseId: string;
  layout: {
    rows: number;
    cols: number;
    version: number;
    updatedAt: string;
    elements: LayoutElement[];
    updatedBy?: string | null;
  } | null;
  placed: PlacedShelfView[];
  unplaced: Warehouse[];
}

export interface SaveLayoutInput {
  rows: number;
  cols: number;
  elements: LayoutElement[];
  placements: ShelfPlacement[];
  version: number;
}

export interface LayoutDraft {
  rows: number;
  cols: number;
  elements: LayoutElement[];
  placements: ShelfPlacement[];
  basedOnVersion: number;
}

export interface Province {
  code: string;
  name: string;
  fullName?: string;
}

export interface Ward {
  code: string;
  name: string;
  fullName?: string;
  provinceCode: string;
}

export interface PlacePrediction {
  place_id: string;
  description: string;
}

export interface PlaceDetail {
  placeId: string;
  address: string;
  lat: number;
  lng: number;
}
