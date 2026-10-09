import type { BrowseCriteria } from '../src/types/customer';
import type { ApiProvince, ApiWard, Warehouse, WarehousesPage } from '../src/types/storage-api';
import { request } from './api';
import { buildWarehouseQuery, FACET_LIMIT, PAGE_SIZE } from './warehouse-query';

export const WarehousesApi = {
  /** One page of AVAILABLE warehouses; filtering and sorting happen on the server. */
  list: (criteria: BrowseCriteria, page: number, signal?: AbortSignal) =>
    request<WarehousesPage>(`/warehouses?${buildWarehouseQuery(criteria, page, PAGE_SIZE)}`, {
      signal,
    }),

  /** Warehouses for a province (or all) without other filters, used to know which areas have stock. */
  listFacets: (provinceCode: string | null, signal?: AbortSignal) => {
    const province = provinceCode ? `&provinceCode=${encodeURIComponent(provinceCode)}` : '';
    return request<WarehousesPage>(`/warehouses?limit=${FACET_LIMIT}${province}`, { signal });
  },

  /** Any status — bookings and contracts keep referencing warehouses that are no longer free. */
  get: (id: string, signal?: AbortSignal) =>
    request<Warehouse>(`/warehouses/${encodeURIComponent(id)}`, { signal }),

  listProvinces: (signal?: AbortSignal) =>
    request<ApiProvince[]>('/locations/provinces', { signal }),

  listWards: (provinceCode: string, signal?: AbortSignal) =>
    request<ApiWard[]>(`/locations/provinces/${provinceCode}/wards`, { signal }),
};
