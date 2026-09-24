import {
  ApiResponse,
  IStorageItem,
  IStorageLocation,
  PresignedUploadUrlResponse,
  StorageDashboardSummary,
  UploadedFileResponse,
} from '@storage/types';
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { AuthUser, LoginInput, LoginResponse, RegisterInput } from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

// Callback hook for 401 unauthenticated events (e.g. session expired)
let unauthorizedHandler: (() => void) | null = null;

export const setUnauthorizedCallback = (callback: (() => void) | null) => {
  unauthorizedHandler = callback;
};

/**
 * Main Axios instance configured for Session-based authentication.
 * `withCredentials: true` ensures that the HTTP-only `sid` session cookie
 * is automatically sent and received on all requests.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // REQUIRED for session cookies!
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Session is handled via cookies, no Bearer token needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response Interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError<{ message?: string | string[]; statusCode?: number }>) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';

    // If 401 Unauthorized, notify listener to clear session
    // Exclude /auth/login and /auth/me to avoid infinite redirect loops
    if (status === 401 && !requestUrl.includes('/auth/login')) {
      if (unauthorizedHandler) {
        unauthorizedHandler();
      }
    }

    // Format error message nicely from backend NestJS responses
    let errorMessage = 'Đã xảy ra lỗi kết nối máy chủ.';
    if (error.response?.data?.message) {
      const msg = error.response.data.message;
      errorMessage = Array.isArray(msg) ? msg.join(', ') : msg;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return Promise.reject(new Error(errorMessage));
  },
);

/**
 * Authentication API Service (Session based)
 */
export const AuthApi = {
  /**
   * Get the current session user info
   */
  me: async (): Promise<AuthUser> => {
    const res = await apiClient.get<ApiResponse<{ user: AuthUser }>>('/auth/me');
    return res.data.data.user;
  },

  /**
   * Authenticate user with email and password.
   * Backend sets the session cookie in response headers.
   */
  login: async (credentials: LoginInput): Promise<AuthUser> => {
    await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', credentials);
    // After session cookie is set, fetch the full user profile
    return await AuthApi.me();
  },

  /**
   * Register a new customer account.
   */
  register: async (data: RegisterInput): Promise<AuthUser> => {
    await apiClient.post<ApiResponse<{ user: AuthUser }>>('/auth/register', data);
    // Automatically log in to establish the session cookie
    return await AuthApi.login({
      email: data.email,
      password: data.password,
    });
  },

  /**
   * Terminate current session and clear cookie
   */
  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    }
  },
};

/**
 * Storage & Facility API Service
 */
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
