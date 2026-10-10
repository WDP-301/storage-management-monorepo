import type { UserRole } from '@storage/types';
import type { Href } from 'expo-router';

/**
 * Mobile app areas a signed-in user can land in.
 * - `staff`: facility staff / managers working on site (handover, inspection, requests).
 * - `customer`: customers browsing, booking and managing their storage units.
 * - `unsupported`: system-wide roles (operations manager, admin) that must use the web app.
 */
export type AppArea = 'staff' | 'customer' | 'unsupported';

// Role codes are compared as literals (type-only import) so the app does not depend on the
// compiled `@storage/types` runtime bundle.
const STAFF_ROLES: readonly UserRole[] = ['FACILITY_STAFF', 'FACILITY_MANAGER'];

/** Picks the highest-priority mobile area for the user's active roles (staff > customer). */
export function resolveAppArea(roles: readonly UserRole[]): AppArea {
  if (roles.some((role) => STAFF_ROLES.includes(role))) return 'staff';
  if (roles.includes('CUSTOMER')) return 'customer';
  return 'unsupported';
}

export const AREA_HOME: Record<AppArea, Href> = {
  staff: '/(staff)/today',
  customer: '/(customer)/browse',
  unsupported: '/unsupported',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  CUSTOMER: 'Khách hàng',
  FACILITY_STAFF: 'Nhân viên chi nhánh',
  FACILITY_MANAGER: 'Quản lý chi nhánh',
  OPERATIONS_MANAGER: 'Quản lý vận hành',
  ADMIN: 'Quản trị viên',
};

/** Label of the role that decided the user's area, e.g. "Quản lý chi nhánh" over "Khách hàng". */
export function primaryRoleLabel(roles: readonly UserRole[]): string {
  const priority: readonly UserRole[] = [
    'FACILITY_MANAGER',
    'FACILITY_STAFF',
    'CUSTOMER',
    'ADMIN',
    'OPERATIONS_MANAGER',
  ];
  const role = priority.find((candidate) => roles.includes(candidate));
  return role ? ROLE_LABELS[role] : 'Chưa có vai trò';
}
