import {
  ApiResponse,
  IStorageItem,
  IStorageLocation,
  PresignedUploadUrlResponse,
  StorageDashboardSummary,
  UploadedFileResponse,
} from '@storage/types';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

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

  // S3 / RustFS Object Storage API
  getPresignedUploadUrl: async (
    fileName: string,
    mimeType: string,
  ): Promise<PresignedUploadUrlResponse> => {
    const res = await apiClient.post<ApiResponse<PresignedUploadUrlResponse>>(
      '/uploads/presigned-url',
      { fileName, mimeType },
    );
    return res.data.data;
  },

  uploadFileDirect: async (file: File): Promise<UploadedFileResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<ApiResponse<UploadedFileResponse>>(
      '/uploads/direct',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    return res.data.data;
  },

  getDownloadUrl: async (fileKey: string): Promise<string> => {
    const res = await apiClient.get<ApiResponse<{ downloadUrl: string }>>('/uploads/download-url', {
      params: { fileKey },
    });
    return res.data.data.downloadUrl;
  },
};
