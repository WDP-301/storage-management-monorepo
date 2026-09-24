import type {
  ApiResponse,
  IStorageItem,
  IStorageLocation,
  StorageDashboardSummary,
} from '@storage/types';
import { Platform } from 'react-native';
import type { AuthUser, LoginInput, RegisterInput } from '../src/types/auth';

const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? `http://${DEV_HOST}:3001/api/v1`;
const REQUEST_TIMEOUT_MS = 10000;

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

type ApiErrorEnvelope = {
  message?: string | string[];
  statusCode?: number;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      signal: init?.signal ?? controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      `Không thể kết nối API tại ${API_BASE_URL}. Kiểm tra backend và EXPO_PUBLIC_API_URL.`,
    );
  } finally {
    clearTimeout(timeout);
  }

  const payload = (await response.json().catch(() => null)) as
    | ApiEnvelope<T>
    | ApiErrorEnvelope
    | null;

  if (!response.ok) {
    const apiMessage = payload && 'message' in payload ? payload.message : undefined;
    const message = Array.isArray(apiMessage)
      ? apiMessage.join('\n')
      : (apiMessage ?? `API error ${response.status}`);
    throw new ApiError(message, response.status);
  }

  if (payload && 'success' in payload && 'data' in payload) {
    return payload.data;
  }

  throw new ApiError('API trả về dữ liệu không hợp lệ.', response.status);
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export const AuthApi = {
  me: async () => {
    const response = await request<{ user: AuthUser }>('/auth/me');
    return response.user;
  },

  login: async (input: LoginInput) => {
    await request<{ sessionId: string; expiresAt: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return AuthApi.me();
  },

  register: async (input: RegisterInput) => {
    await request<{ user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return AuthApi.login({ email: input.email, password: input.password });
  },

  logout: () =>
    request<{ loggedOut: boolean }>('/auth/logout', {
      method: 'POST',
    }),
};

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
