import type {
  ApiProvince,
  ApiStorageUnit,
  ApiStorageUnitsPage,
  ApiWard,
} from '../src/types/storage-api';
import { request } from './api';

/** Highest `limit` the API accepts (`QueryStorageUnitsDto` caps it at 100). */
const PAGE_SIZE = 100;

/**
 * Safety cap on how many pages we pull. Browse filters run client-side, so we need the whole
 * result set to filter correctly — but we still refuse to walk an unbounded list.
 */
const MAX_PAGES = 5;

export const BrowseUnitsApi = {
  /**
   * Every storage unit the API considers available (it forces `status = AVAILABLE` server-side).
   *
   * Walks all pages so client-side filtering sees the complete set. `hasMore` reports that the
   * page cap truncated the result, so the UI can tell the user the list is incomplete instead of
   * silently filtering over partial data.
   */
  listAvailableUnits: async (
    signal?: AbortSignal,
  ): Promise<{ units: ApiStorageUnit[]; hasMore: boolean }> => {
    const units: ApiStorageUnit[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= Math.min(totalPages, MAX_PAGES)) {
      const result = await request<ApiStorageUnitsPage>(
        `/storage-units?page=${page}&limit=${PAGE_SIZE}`,
        { signal },
      );
      units.push(...result.units);
      totalPages = result.meta.totalPages;
      page += 1;
    }

    return { units, hasMore: totalPages > MAX_PAGES };
  },

  listProvinces: (signal?: AbortSignal) =>
    request<ApiProvince[]>('/locations/provinces', { signal }),

  listWards: (provinceCode: string, signal?: AbortSignal) =>
    request<ApiWard[]>(`/locations/provinces/${provinceCode}/wards`, { signal }),
};
