export type CustomerTab = 'browse' | 'bookings' | 'storage' | 'settings';
/** Browse renders either the warehouse list or the map; both read the same data. */
export type BrowseView = 'list' | 'map';

export type RangePresetKey = string;

export type WarehouseSort = 'price_asc' | 'price_desc' | 'area_asc' | 'area_desc' | 'newest';

/** Everything the browse filter sheet edits; each field maps onto a `GET /warehouses` query param. */
export type BrowseCriteria = {
  provinceCode: string | null;
  wardCode: string | null;
  areaPreset: RangePresetKey;
  volumePreset: RangePresetKey;
  pricePreset: RangePresetKey;
  sort: WarehouseSort;
};
