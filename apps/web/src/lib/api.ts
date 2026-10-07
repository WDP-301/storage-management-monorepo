import {
  ApiResponse,
  ChangeRequestStatus,
  StorageUnitStatus,
  SystemSettingRecord,
  SystemSettingsResponse,
  UpdateSettingsResponse,
  UserStatus,
} from '@storage/types';
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  AdminUser,
  AdminUserListResponse,
  AdminUserResponse,
  AssignRoleDto,
  ListUsersQuery,
  RevokeRoleResponse,
} from '../types/admin-user';
import { AuthUser, LoginInput, LoginResponse, RegisterInput } from '../types/auth';
import type {
  AssignTicketDto,
  ListTicketsQuery,
  ServiceTicketDeleteResponse,
  ServiceTicketListResponse,
  ServiceTicketRecord,
  ServiceTicketResponse,
  UpdateTicketDto,
} from '../types/service-tickets';

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
    if (status === 401 && !requestUrl.includes('/auth/login') && !requestUrl.includes('/auth/me')) {
      unauthorizedHandler?.();
    }

    // Format error message nicely from backend NestJS responses
    let errorMessage = 'Đã xảy ra lỗi kết nối máy chủ.';
    if (error.response?.data?.message) {
      const msg = error.response.data.message;
      errorMessage = Array.isArray(msg) ? msg.join(', ') : msg;
    } else if (error.message) {
      errorMessage = error.message;
    }

    const err = new Error(errorMessage) as Error & { status?: number };
    err.status = status;
    return Promise.reject(err);
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
 * Facility / unit / ticket portal services (facility-scoped roles)
 */
export interface FacilityRecord {
  id: string;
  code: string;
  name: string;
  addressLine: string;
  status: string;
}

export interface ManagedUnit {
  id: string;
  code: string;
  zone?: string | null;
  areaM2: string;
  status: StorageUnitStatus;
  unitType: { id: string; code: string; name: string; monthlyPrice: string };
}

export interface UnitChangeRequestRecord {
  id: string;
  status: ChangeRequestStatus;
  reason: string;
  rent_difference: number;
  decision_note: string | null;
  facility_id: string | null;
  created_at: string;
  requester: { id: string; full_name: string; email: string } | null;
  old_unit: { id: string; code: string } | null;
  new_unit: { id: string; code: string } | null;
}

export type { ServiceTicketRecord };

interface Paged {
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export const FacilitiesApi = {
  mine: async (): Promise<FacilityRecord[]> => {
    const res = await apiClient.get<ApiResponse<FacilityRecord[]>>('/facilities/mine');
    return res.data.data;
  },

  listAll: async (): Promise<FacilityRecord[]> => {
    const res = await apiClient.get<ApiResponse<FacilityRecord[]>>('/facilities');
    return res.data.data;
  },
};

export const UnitsApi = {
  managed: async (
    facilityId: string,
    params?: { page?: number; limit?: number; status?: StorageUnitStatus },
  ) => {
    const res = await apiClient.get<ApiResponse<{ units: ManagedUnit[] } & Paged>>(
      '/storage-units/managed',
      { params: { facilityId, ...params } },
    );
    return res.data.data;
  },

  updateStatus: async (id: string, status: 'AVAILABLE' | 'MAINTENANCE') => {
    const res = await apiClient.patch<ApiResponse<ManagedUnit>>(`/storage-units/${id}/status`, {
      status,
    });
    return res.data.data;
  },
};

export const ChangeRequestsApi = {
  list: async (params?: { page?: number; limit?: number }) => {
    const res = await apiClient.get<ApiResponse<{ requests: UnitChangeRequestRecord[] } & Paged>>(
      '/unit-change-requests',
      { params: { limit: 50, ...params } },
    );
    return res.data.data;
  },

  decide: async (id: string, decision: 'APPROVED' | 'REJECTED', decisionNote?: string) => {
    const res = await apiClient.patch<ApiResponse<{ request: UnitChangeRequestRecord }>>(
      `/unit-change-requests/${id}/decide`,
      { decision, decisionNote },
    );
    return res.data.data;
  },
};

/**
 * Service Tickets API Service
 */
export const TicketsApi = {
  /**
   * List tickets visible to user with pagination and optional filters
   */
  getAll: async (params?: ListTicketsQuery): Promise<ServiceTicketListResponse> => {
    const res = await apiClient.get<
      ApiResponse<ServiceTicketListResponse> | ServiceTicketListResponse
    >('/service-tickets', {
      params,
    });
    const body = res.data && 'data' in res.data ? res.data.data : res.data;
    return body;
  },

  /**
   * Get a single ticket by ID
   */
  getOne: async (id: string): Promise<ServiceTicketRecord> => {
    const res = await apiClient.get<ApiResponse<ServiceTicketResponse> | ServiceTicketResponse>(
      `/service-tickets/${id}`,
    );
    const body = res.data && 'data' in res.data ? res.data.data : res.data;
    return body.ticket;
  },

  /**
   * Assign a facility staff member to a ticket (Facility Manager & Admin)
   */
  assign: async (id: string, assignedTo: string): Promise<ServiceTicketRecord> => {
    const payload: AssignTicketDto = { assignedTo };
    const res = await apiClient.patch<ApiResponse<ServiceTicketResponse> | ServiceTicketResponse>(
      `/service-tickets/${id}/assign`,
      payload,
    );
    const body = res.data && 'data' in res.data ? res.data.data : res.data;
    return body.ticket;
  },

  /**
   * Update processing fields of a ticket (assigned Staff, facility Manager, Admin)
   */
  update: async (id: string, dto: UpdateTicketDto): Promise<ServiceTicketRecord> => {
    const res = await apiClient.patch<ApiResponse<ServiceTicketResponse> | ServiceTicketResponse>(
      `/service-tickets/${id}`,
      dto,
    );
    const body = res.data && 'data' in res.data ? res.data.data : res.data;
    return body.ticket;
  },

  /**
   * Cancel a ticket that is still being worked (owning Customer or facility Manager)
   */
  cancel: async (id: string): Promise<ServiceTicketRecord> => {
    const res = await apiClient.patch<ApiResponse<ServiceTicketResponse> | ServiceTicketResponse>(
      `/service-tickets/${id}/cancel`,
    );
    const body = res.data && 'data' in res.data ? res.data.data : res.data;
    return body.ticket;
  },

  /**
   * Delete a service ticket (Facility Manager & Admin)
   */
  remove: async (id: string): Promise<ServiceTicketDeleteResponse> => {
    const res = await apiClient.delete<
      ApiResponse<ServiceTicketDeleteResponse> | ServiceTicketDeleteResponse
    >(`/service-tickets/${id}`);
    const body = res.data && 'data' in res.data ? res.data.data : res.data;
    return body;
  },
};

/**
 * System Settings API Service
 */
export const SettingsApi = {
  /**
   * Fetch all system settings from the server.
   */
  getAll: async (): Promise<SystemSettingRecord[]> => {
    const res = await apiClient.get<ApiResponse<SystemSettingsResponse>>('/admin/settings');
    return res.data.data.settings;
  },

  /**
   * Update one or more system settings.
   */
  update: async (values: Record<string, unknown>): Promise<SystemSettingRecord[]> => {
    const res = await apiClient.patch<ApiResponse<UpdateSettingsResponse>>('/admin/settings', {
      values,
    });
    return res.data.data.settings;
  },
};

/**
 * Admin User Management API Service
 */
export const AdminUsersApi = {
  /**
   * List users with pagination and optional filters (search, status, role)
   */
  list: async (params?: ListUsersQuery): Promise<AdminUserListResponse> => {
    const res = await apiClient.get<ApiResponse<AdminUserListResponse>>('/admin/users', {
      params,
    });
    return res.data.data;
  },

  /**
   * Get a single user by ID including their role assignments
   */
  getById: async (id: string): Promise<AdminUser> => {
    const res = await apiClient.get<ApiResponse<AdminUserResponse>>(`/admin/users/${id}`);
    return res.data.data.user;
  },

  /**
   * Change user account status (ACTIVE, SUSPENDED, DISABLED)
   */
  updateStatus: async (id: string, status: UserStatus): Promise<AdminUser> => {
    const res = await apiClient.patch<ApiResponse<AdminUserResponse>>(`/admin/users/${id}/status`, {
      status,
    });
    return res.data.data.user;
  },

  /**
   * Assign a role to a user
   */
  assignRole: async (id: string, dto: AssignRoleDto): Promise<AdminUser> => {
    const res = await apiClient.post<ApiResponse<AdminUserResponse>>(
      `/admin/users/${id}/roles`,
      dto,
    );
    return res.data.data.user;
  },

  /**
   * Revoke a role assignment from a user
   */
  revokeRole: async (id: string, assignmentId: string): Promise<boolean> => {
    const res = await apiClient.delete<ApiResponse<RevokeRoleResponse>>(
      `/admin/users/${id}/roles/${assignmentId}`,
    );
    return res.data.data.revoked;
  },
};
