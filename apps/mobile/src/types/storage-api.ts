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

/** A warehouse (kho). `id` is the storage unit id that bookings, holds and tickets reference. */
export type Warehouse = {
  id: string;
  /** The branch (cơ sở) the warehouse belongs to. */
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
