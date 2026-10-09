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

export interface WarehouseFacility {
  id: string;
  code: string;
  name: string;
}

export interface Warehouse {
  id: string;
  facility: WarehouseFacility;
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
  page?: number;
  limit?: number;
}

export interface WarehouseListResponse {
  warehouses: Warehouse[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface WarehouseInput {
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
  monthlyPrice: number;
  /** `null` falls back to the system default deposit level. */
  depositMonths: number | null;
  notes?: string;
  status?: WarehouseIdleStatus;
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
