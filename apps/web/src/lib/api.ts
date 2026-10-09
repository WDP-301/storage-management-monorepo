import {
  ApiResponse,
  ChangeRequestStatus,
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
import { AuthUser, LoginInput, LoginResponse } from '../types/auth';
import type {
  FacilityStaffMember,
  InspectionRecord,
  ListInspectionsQuery,
} from '../types/inspection';
import type {
  AssignTicketDto,
  ListTicketsQuery,
  ServiceTicketDeleteResponse,
  ServiceTicketListResponse,
  ServiceTicketRecord,
  ServiceTicketResponse,
  UpdateTicketDto,
} from '../types/service-tickets';
import type {
  PlaceDetail,
  PlacePrediction,
  Province,
  Ward,
  Warehouse,
  WarehouseInput,
  WarehouseListQuery,
  WarehouseListResponse,
} from '../types/warehouse';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

/** Error surfaced by every Api call: server message plus machine-readable context. */
export type ApiError = Error & {
  status?: number;
  code?: string;
  details?: Record<string, unknown>;
};

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
  (
    error: AxiosError<{
      message?: string | string[];
      statusCode?: number;
      code?: string;
      details?: Record<string, unknown>;
    }>,
  ) => {
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

    const err = new Error(errorMessage) as ApiError;
    err.status = status;
    err.code = error.response?.data?.code;
    err.details = error.response?.data?.details;
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
  provinceCode: string | null;
  status: string;
  /** Live warehouses; present on back-office rows only. */
  warehouseCount?: number;
}

export interface FacilityInput {
  code: string;
  name: string;
  provinceCode?: string | null;
  status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
}

export interface FacilityListQuery {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface UnitChangeRequestRecord {
  id: string;
  status: ChangeRequestStatus;
  reason: string;
  rent_difference: string | number;
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

const LIST_ALL_PAGE_SIZE = 100;

export const FacilitiesApi = {
  mine: async (): Promise<FacilityRecord[]> => {
    const res = await apiClient.get<ApiResponse<FacilityRecord[]>>('/facilities/mine');
    return res.data.data;
  },

  /** One page of facilities for the admin page (ADMIN, OPERATIONS_MANAGER). */
  listAdmin: async (
    query: FacilityListQuery = {},
  ): Promise<{ facilities: FacilityRecord[] } & Paged> => {
    const res = await apiClient.get<ApiResponse<{ facilities: FacilityRecord[] } & Paged>>(
      '/facilities/admin',
      { params: query },
    );
    return res.data.data;
  },

  /** Every facility regardless of status; pages through the API so pickers are never truncated. */
  listAll: async (): Promise<FacilityRecord[]> => {
    const all: FacilityRecord[] = [];
    for (let page = 1; ; page += 1) {
      const { facilities, meta } = await FacilitiesApi.listAdmin({
        page,
        limit: LIST_ALL_PAGE_SIZE,
      });
      all.push(...facilities);
      if (page >= meta.totalPages || facilities.length === 0) return all;
    }
  },

  create: async (input: FacilityInput): Promise<FacilityRecord> => {
    const res = await apiClient.post<ApiResponse<FacilityRecord>>('/facilities', input);
    return res.data.data;
  },

  update: async (id: string, input: Partial<FacilityInput>): Promise<FacilityRecord> => {
    const res = await apiClient.patch<ApiResponse<FacilityRecord>>(`/facilities/${id}`, input);
    return res.data.data;
  },

  /** Active staff of a facility — the people a manager can assign work to. */
  listStaff: async (facilityId: string): Promise<FacilityStaffMember[]> => {
    const res = await apiClient.get<ApiResponse<FacilityStaffMember[]>>(
      `/facilities/${facilityId}/staff`,
    );
    return res.data.data;
  },
};

export const InspectionsApi = {
  /** Scoped by the API to the facilities the caller manages. */
  list: async (query: ListInspectionsQuery = {}): Promise<InspectionRecord[]> => {
    const res = await apiClient.get<ApiResponse<InspectionRecord[]>>('/inspections', {
      params: query,
    });
    return res.data.data;
  },

  get: async (id: string): Promise<InspectionRecord> => {
    const res = await apiClient.get<ApiResponse<InspectionRecord>>(`/inspections/${id}`);
    return res.data.data;
  },

  assign: async (id: string, inspectedBy: string): Promise<InspectionRecord> => {
    const res = await apiClient.patch<ApiResponse<InspectionRecord>>(`/inspections/${id}/assign`, {
      inspectedBy,
    });
    return res.data.data;
  },

  finalize: async (id: string): Promise<InspectionRecord> => {
    const res = await apiClient.post<ApiResponse<InspectionRecord>>(`/inspections/${id}/finalize`);
    return res.data.data;
  },
};

export const ContractsApi = {
  /** Drops a DRAFT contract the customer never collected and frees its unit. */
  cancel: async (id: string): Promise<void> => {
    await apiClient.post(`/contracts/${id}/cancel`);
  },
};

export const UploadsApi = {
  /** Presigned GET for a private object; links expire, so resolve right before opening. */
  downloadUrl: async (fileKey: string): Promise<string> => {
    const res = await apiClient.get<ApiResponse<{ downloadUrl: string }>>('/uploads/download-url', {
      params: { fileKey },
    });
    return res.data.data.downloadUrl;
  },
};

export const WarehousesApi = {
  /** Back-office list over every status (ADMIN, OPERATIONS_MANAGER). */
  listAdmin: async (query: WarehouseListQuery = {}): Promise<WarehouseListResponse> => {
    const res = await apiClient.get<ApiResponse<WarehouseListResponse>>('/warehouses/admin', {
      params: query,
    });
    return res.data.data;
  },

  /** Every back-office row matching the query, paging past the API page-size ceiling. */
  listAdminAll: async (query: WarehouseListQuery = {}): Promise<Warehouse[]> => {
    const all: Warehouse[] = [];
    for (let page = 1; ; page += 1) {
      const res = await WarehousesApi.listAdmin({ ...query, page, limit: LIST_ALL_PAGE_SIZE });
      all.push(...res.warehouses);
      if (page >= res.meta.totalPages || res.warehouses.length === 0) return all;
    }
  },

  /** Warehouses assigned to the calling facility manager / staff. */
  listMine: async (query: { facilityId?: string } = {}): Promise<Warehouse[]> => {
    const res = await apiClient.get<ApiResponse<Warehouse[]>>('/warehouses/mine', {
      params: query,
    });
    return res.data.data;
  },

  get: async (id: string): Promise<Warehouse> => {
    const res = await apiClient.get<ApiResponse<Warehouse>>(`/warehouses/${id}`);
    return res.data.data;
  },

  create: async (input: WarehouseInput): Promise<Warehouse> => {
    const res = await apiClient.post<ApiResponse<Warehouse>>('/warehouses', input);
    return res.data.data;
  },

  update: async (id: string, input: Partial<WarehouseInput>): Promise<Warehouse> => {
    const res = await apiClient.patch<ApiResponse<Warehouse>>(`/warehouses/${id}`, input);
    return res.data.data;
  },

  updateStatus: async (id: string, status: 'AVAILABLE' | 'MAINTENANCE'): Promise<Warehouse> => {
    const res = await apiClient.patch<ApiResponse<Warehouse>>(`/warehouses/${id}/status`, {
      status,
    });
    return res.data.data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/warehouses/${id}`);
  },
};

export const PlacesApi = {
  autocomplete: async (input: string): Promise<PlacePrediction[]> => {
    const res = await apiClient.get<ApiResponse<PlacePrediction[]>>('/places/autocomplete', {
      params: { input },
    });
    return res.data.data;
  },

  detail: async (placeId: string): Promise<PlaceDetail> => {
    const res = await apiClient.get<ApiResponse<PlaceDetail>>('/places/detail', {
      params: { place_id: placeId },
    });
    return res.data.data;
  },
};

export const LocationsApi = {
  provinces: async (): Promise<Province[]> => {
    const res = await apiClient.get<ApiResponse<Province[]>>('/locations/provinces');
    return res.data.data;
  },

  wards: async (provinceCode: string): Promise<Ward[]> => {
    const res = await apiClient.get<ApiResponse<Ward[]>>(
      `/locations/provinces/${provinceCode}/wards`,
    );
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
