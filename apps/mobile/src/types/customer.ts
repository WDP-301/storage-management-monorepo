export type CustomerTab = 'browse' | 'bookings' | 'settings';
export type BrowseMode = 'recommended' | 'manual';

export type UnitOffer = {
  id: string;
  facilityId: string;
  facility: string;
  address: string;
  code: string;
  zone: string;
  /** Numeric area used for filtering; `size` is its display form. */
  areaM2: number;
  size: string;
  dimensions: string;
  monthlyPrice: number;
  deposit: number;
  unitTypeId: string;
  unitTypeName: string;
  provinceCode: string | null;
  wardCode: string | null;
  notes: string | null;
  /** Facility coordinates, kept so distance sorting can be added without touching the fetch layer. */
  latitude: number;
  longitude: number;
};

export type FacilityOffer = {
  id: string;
  name: string;
  address: string;
  provinceCode: string | null;
  wardCode: string | null;
  units: UnitOffer[];
};

/** Preset area buckets offered in the filter card. */
export type AreaPresetKey = 'any' | 'small' | 'medium' | 'large';

/**
 * Everything the browse filter card edits.
 *
 * Only `provinceCode`, `wardCode`, `areaPreset` and `maxMonthlyPrice` narrow the unit list.
 * `requestedQuantity` and `durationMonths` do not filter anything — the API has no notion of
 * availability over a date range — they carry into the hold and the price summary.
 */
export type BrowseCriteria = {
  provinceCode: string | null;
  wardCode: string | null;
  areaPreset: AreaPresetKey;
  maxMonthlyPrice: number | null;
  requestedQuantity: number;
  durationMonths: number;
};

export type HeldBooking = {
  id: string;
  units: UnitOffer[];
  startDate: string;
  durationMonths: number;
  holdExpiresAt: number;
};
