import type { PaginationMeta, UserRole, UserStatus } from '@storage/types';

/** A single role grant as exposed to admins, including its facility scope and validity window. */
export interface AdminRoleAssignment {
  id: string;
  role: UserRole;
  facilityId: string | null;
  startsAt: Date;
  endsAt: Date | null;
}

/** Admin-facing representation of an `app_users` record. Never includes `password_hash`. */
export interface AdminUser {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  roles: AdminRoleAssignment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUserResponse {
  user: AdminUser;
}

export interface AdminUserListResponse {
  users: AdminUser[];
  meta: PaginationMeta;
}

export interface RevokeRoleResponse {
  revoked: boolean;
}
