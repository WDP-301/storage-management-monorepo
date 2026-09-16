import {
  ApiResponse,
  IStorageItem,
  IStorageLocation,
  StorageDashboardSummary,
} from '@storage/types';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const StorageApi = {
  getDashboardSummary: async (): Promise<StorageDashboardSummary> => {
    const res = await apiClient.get<ApiResponse<StorageDashboardSummary>>('/storage/dashboard');
    return res.data.data;
  },

  getItems: async (params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const res = await apiClient.get<ApiResponse<IStorageItem[]>>('/storage/items', {
      params,
    });
    return res.data;
  },

  getLocations: async (): Promise<IStorageLocation[]> => {
    const res = await apiClient.get<ApiResponse<IStorageLocation[]>>('/storage/locations');
    return res.data.data;
  },

  createItem: async (data: Partial<IStorageItem>) => {
    const res = await apiClient.post<ApiResponse<IStorageItem>>('/storage/items', data);
    return res.data.data;
  },
};
