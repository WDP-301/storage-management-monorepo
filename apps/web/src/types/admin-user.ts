import type { PaginationMeta, UserRole, UserStatus } from '@storage/types';

/** A single role assignment record as returned by the Admin Users API */
export interface AdminRoleAssignment {
  id: string;
  role: UserRole;
  facilityId: string | null;
  startsAt: string | Date;
  endsAt: string | Date | null;
}

/** Admin-facing user profile representation */
export interface AdminUser {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  status: UserStatus;
  emailVerifiedAt: string | Date | null;
  roles: AdminRoleAssignment[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

/** Query parameters for user listing */
export interface ListUsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: UserStatus;
  role?: UserRole;
}

/** DTO for assigning a role to a user */
export interface AssignRoleDto {
  role: UserRole;
  facilityId?: string;
  startsAt?: string;
  endsAt?: string;
}

/** DTO for updating user status */
export interface UpdateUserStatusDto {
  status: UserStatus;
}

/** Envelope data returned for user list */
export interface AdminUserListResponse {
  users: AdminUser[];
  meta: PaginationMeta;
}

/** Envelope data returned for single user */
export interface AdminUserResponse {
  user: AdminUser;
}

/** Envelope data returned for role revocation */
export interface RevokeRoleResponse {
  revoked: boolean;
}
