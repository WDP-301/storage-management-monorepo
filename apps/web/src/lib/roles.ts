import { UserRole } from '@storage/types';

export interface RoleConfig {
  role: UserRole;
  title: string;
  defaultPath: string;
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  [UserRole.ADMIN]: {
    role: UserRole.ADMIN,
    title: 'Quản trị viên',
    defaultPath: '/admin/users',
  },
  [UserRole.OPERATIONS_MANAGER]: {
    role: UserRole.OPERATIONS_MANAGER,
    title: 'Quản lý vận hành',
    defaultPath: '/unassigned-role',
  },
  [UserRole.FACILITY_MANAGER]: {
    role: UserRole.FACILITY_MANAGER,
    title: 'Quản lý cơ sở',
    defaultPath: '/facility-manager',
  },
  [UserRole.FACILITY_STAFF]: {
    role: UserRole.FACILITY_STAFF,
    title: 'Nhân viên cơ sở',
    defaultPath: '/unassigned-role',
  },
  [UserRole.CUSTOMER]: {
    role: UserRole.CUSTOMER,
    title: 'Khách hàng',
    defaultPath: '/unassigned-role',
  },
};

/**
 * Get the landing URL for a given role
 */
export function getRoleDefaultPath(role?: UserRole | null): string {
  if (!role || !ROLE_CONFIGS[role]) {
    return '/unassigned-role';
  }
  return ROLE_CONFIGS[role].defaultPath;
}

/**
 * Get the Vietnamese display title for a role
 */
export function getRoleTitle(role?: UserRole | null): string {
  if (!role || !ROLE_CONFIGS[role]) {
    return 'Chưa gán vai trò';
  }
  return ROLE_CONFIGS[role].title;
}

/**
 * Check if user roles contain at least one of the allowed roles
 */
export function hasAllowedRole(
  userRoles: UserRole[] | undefined,
  allowedRoles: UserRole[],
): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  return userRoles.some((r) => allowedRoles.includes(r));
}
