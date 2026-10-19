/**
 * Raw response shapes from the warehouse API.
 *
 * Unlike the old unit endpoints, `/warehouses` serialises numeric columns as JSON numbers, so no
 * string-to-number coercion is needed on the client.
 */

export type WarehouseStatus =
  | 'AVAILABLE'
  | 'HELD'
  | 'BOOKED'
  | 'RENTED'
  | 'PENDING_INSPECTION'
  | 'MAINTENANCE'
  | 'INACTIVE';

/** A warehouse photo; `url` is a presigned link that expires, so refetch instead of caching it. */
export type WarehouseImage = {
  fileKey: string;
  name: string;
  mimeType: string;
  size?: number;
  url: string;
};

export type ShelfSummary = {
  total: number;
  available: number;
  minMonthlyPrice: number | null;
  statusCounts: Partial<Record<WarehouseStatus, number>>;
  minAreaM2: number | null;
  maxAreaM2: number | null;
  minVolumeM3: number | null;
  maxVolumeM3: number | null;
};

/** Public amenity catalog entry (`GET /amenities`); only active entries are returned. */
export type Amenity = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
};

/** Equipment included in the rent. Retired catalog entries still appear on warehouses that carry them. */
export type WarehouseAmenity = {
  amenityId: string;
  code: string;
  name: string;
  quantity: number;
  note: string | null;
};

/** A warehouse or shelf. Only SELF_STORAGE and SHELF are directly rentable. */
export type Warehouse = {
  id: string;
  kind: 'SELF_STORAGE' | 'SHELF_WAREHOUSE' | 'SHELF';
  parentId: string | null;
  parent: { id: string; code: string; name: string } | null;
  shelfSummary: ShelfSummary | null;
  /** The branch (chi nhánh) the warehouse belongs to. */
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
  depositMonths: number | null;
  /** Months of rent charged as deposit; deposit in VND is `monthlyPrice × effectiveDepositMonths`. */
  effectiveDepositMonths: number;
  status: WarehouseStatus;
  notes: string | null;
  /** Display order; the first one is the cover. */
  images: WarehouseImage[];
  /** Absent when the API predates amenities; always empty for shelves. */
  amenities?: WarehouseAmenity[];
};

export type ShelfLayout = {
  warehouseId: string;
  layout: {
    rows: number;
    cols: number;
    version: number;
    elements: Array<{
      type: string;
      text?: string;
      row: number;
      col: number;
      rowSpan: number;
      colSpan: number;
    }>;
  } | null;
  placed: Array<{
    shelf: Warehouse;
    row: number;
    col: number;
    rowSpan: number;
    colSpan: number;
  }>;
  unplaced: Warehouse[];
};

export type NearbyWarehouse = Warehouse & { distanceKm: number };

export type ApiPaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/** `GET /warehouses` — the array is named to avoid double-nesting under `data`. */
export type WarehousesPage = {
  warehouses: Warehouse[];
  meta: ApiPaginationMeta;
};

/** `GET /places/nearby`. */
export type NearbyPlacesResult = {
  center: { lat: number; lng: number };
  warehouses: NearbyWarehouse[];
};

/** `GET /locations/provinces` and `/locations/provinces/:code/wards`. */
export type ApiProvince = {
  code: string;
  name: string;
  nameEn: string;
  fullName: string;
  fullNameEn: string;
  codeName: string;
};

export type ApiWard = ApiProvince & {
  provinceCode: string;
};
