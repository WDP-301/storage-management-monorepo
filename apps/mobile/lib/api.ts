import type {
  ApiResponse,
  IStorageItem,
  IStorageLocation,
  StorageDashboardSummary,
} from '@storage/types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export const StorageApi = {
  getDashboardSummary: () => get<ApiResponse<StorageDashboardSummary>>('/storage/dashboard'),

  getItems: (params?: { search?: string; status?: string }) => {
    const qs = [
      params?.search && `search=${encodeURIComponent(params.search)}`,
      params?.status && `status=${encodeURIComponent(params.status)}`,
    ]
      .filter(Boolean)
      .join('&');
    return get<ApiResponse<IStorageItem[]>>(`/storage/items${qs ? `?${qs}` : ''}`);
  },

  getLocations: () => get<ApiResponse<IStorageLocation[]>>('/storage/locations'),
};
