import type { FacilityStatus, StorageUnitStatus } from '@storage/types';

/**
 * Raw response shapes from the API, mirroring the TypeORM entities as they arrive over the wire.
 *
 * Postgres `decimal` columns are serialised as strings because the API declares no numeric
 * transformer, so every dimension/price/coordinate below is typed `string` on purpose. Convert
 * with `Number()` before doing arithmetic or comparisons — see `storage-unit-mapper.ts`.
 */

export type ApiFacility = {
  id: string;
  code: string;
  name: string;
  addressLine: string;
  wardCode?: string | null;
  provinceCode?: string | null;
  /** decimal */
  latitude: string;
  /** decimal */
  longitude: string;
  status: FacilityStatus;
};

export type ApiUnitType = {
  id: string;
  code: string;
  name: string;
  /** decimal */
  widthM: string;
  /** decimal */
  lengthM: string;
  /** decimal */
  heightM?: string | null;
  /** decimal */
  monthlyPrice: string;
  /** decimal */
  defaultDepositMonths: string;
};

export type ApiStorageUnit = {
  id: string;
  facilityId: string;
  unitTypeId: string;
  code: string;
  zone?: string | null;
  /** decimal */
  areaM2: string;
  status: StorageUnitStatus;
  notes?: string | null;
  /** `null` when the related facility was soft-deleted (left join). */
  facility: ApiFacility | null;
  /** `null` when the related unit type was soft-deleted (left join). */
  unitType: ApiUnitType | null;
};

export type ApiPaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/** `GET /storage-units` — the service names the array to avoid double-nesting under `data`. */
export type ApiStorageUnitsPage = {
  units: ApiStorageUnit[];
  meta: ApiPaginationMeta;
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
