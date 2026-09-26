import type { BadgeVariant } from '@cloudflare/kumo';
import { UserRole } from '@storage/types';

export interface RoleConfig {
  role: UserRole;
  title: string;
  description: string;
  defaultPath: string;
  badgeVariant: BadgeVariant;
  colorHex: string;
  iconName: string;
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  [UserRole.ADMIN]: {
    role: UserRole.ADMIN,
    title: 'Quản trị viên',
    description: 'Quản trị toàn bộ người dùng, phân quyền, cơ sở và hệ thống',
    defaultPath: '/admin',
    badgeVariant: 'purple',
    colorHex: '#8b5cf6',
    iconName: 'ShieldAlert',
  },
  [UserRole.OPERATIONS_MANAGER]: {
    role: UserRole.OPERATIONS_MANAGER,
    title: 'Quản lý vận hành',
    description: 'Giám sát mạng lưới kho bãi, tỷ lệ lấp đầy, điều phối và phân tích doanh thu',
    defaultPath: '/operations',
    badgeVariant: 'blue',
    colorHex: '#3b82f6',
    iconName: 'LineChart',
  },
  [UserRole.FACILITY_MANAGER]: {
    role: UserRole.FACILITY_MANAGER,
    title: 'Quản lý cơ sở',
    description: 'Quản lý kho tại chi nhánh, phê duyệt yêu cầu đổi kho và biểu giá đơn vị kho',
    defaultPath: '/facility-manager',
    badgeVariant: 'teal',
    colorHex: '#14b8a6',
    iconName: 'Building2',
  },
  [UserRole.FACILITY_STAFF]: {
    role: UserRole.FACILITY_STAFF,
    title: 'Nhân viên cơ sở',
    description: 'Thực hiện ca trực kiểm tra kho, hỗ trợ check-in/out và báo cáo sự cố',
    defaultPath: '/facility-staff',
    badgeVariant: 'warning',
    colorHex: '#f59e0b',
    iconName: 'ClipboardCheck',
  },
  [UserRole.CUSTOMER]: {
    role: UserRole.CUSTOMER,
    title: 'Khách hàng',
    description: 'Tra cứu kho đang thuê, giữ chỗ, lấy mã PIN truy cập và thanh toán hoá đơn',
    defaultPath: '/customer',
    badgeVariant: 'success',
    colorHex: '#10b981',
    iconName: 'UserCheck',
  },
};

/**
 * Get the landing URL for a given role
 */
export function getRoleDefaultPath(role?: UserRole | null): string {
  if (!role || !ROLE_CONFIGS[role]) {
    return '/customer';
  }
  return ROLE_CONFIGS[role].defaultPath;
}

/**
 * Get the Vietnamese display title for a role
 */
export function getRoleTitle(role?: UserRole | null): string {
  if (!role || !ROLE_CONFIGS[role]) {
    return 'Người dùng';
  }
  return ROLE_CONFIGS[role].title;
}

/**
 * Get the badge variant for a role
 */
export function getRoleBadgeVariant(role?: UserRole | null): BadgeVariant {
  if (!role || !ROLE_CONFIGS[role]) {
    return 'neutral';
  }
  return ROLE_CONFIGS[role].badgeVariant;
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
