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
 * Everything the browse filter sheet edits.
 *
 * All of it narrows the unit list except `requestedQuantity`, which decides how many units each
 * facility card proposes. Rental dates live on the schedule screen instead: the API has no
 * availability-over-time query, so they never belonged among the filters.
 */
export type BrowseCriteria = {
  provinceCode: string | null;
  wardCode: string | null;
  areaPreset: AreaPresetKey;
  maxMonthlyPrice: number | null;
  requestedQuantity: number;
};
