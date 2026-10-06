import { Badge, Button, Select, Sidebar, Text, useSidebar } from '@cloudflare/kumo';
import {
  ChartLine,
  ClipboardText,
  Faders,
  Gauge,
  GearSix,
  Package,
  SignOut,
  User,
  Warehouse,
} from '@phosphor-icons/react';
import { UserRole } from '@storage/types';
import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFacility } from '../context/FacilityContext';
import { getRoleDefaultPath, getRoleTitle } from '../lib/roles';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const OVERVIEW_ITEM: NavItem = {
  to: '/dashboard',
  label: 'Tổng quan & Hàng tồn',
  icon: Gauge,
};

const ROLE_NAV: Record<UserRole, NavItem[]> = {
  [UserRole.ADMIN]: [
    { to: '/admin', label: 'Quản trị hệ thống', icon: GearSix },
    { to: '/admin/settings', label: 'Cấu hình tham số', icon: Faders },
    { to: '/operations', label: 'Điều hành & Vận hành', icon: ChartLine },
    { to: '/facility-manager', label: 'Quản lý cơ sở kho', icon: Warehouse },
    { to: '/facility-staff', label: 'Ca trực & Kiểm tra', icon: ClipboardText },
    { to: '/customer', label: 'Kho lưu trữ khách hàng', icon: Package },
  ],
  [UserRole.OPERATIONS_MANAGER]: [
    { to: '/operations', label: 'Điều hành & Vận hành', icon: ChartLine },
    { to: '/admin/settings', label: 'Cấu hình tham số', icon: Faders },
  ],
  [UserRole.FACILITY_MANAGER]: [
    { to: '/facility-manager', label: 'Quản lý cơ sở kho', icon: Warehouse },
    { to: '/facility-staff', label: 'Ca trực & Kiểm tra', icon: ClipboardText },
  ],
  [UserRole.FACILITY_STAFF]: [
    { to: '/facility-staff', label: 'Ca trực & Kiểm tra', icon: ClipboardText },
  ],
  [UserRole.CUSTOMER]: [{ to: '/customer', label: 'Kho lưu trữ của tôi', icon: Package }],
};

const OVERVIEW_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.OPERATIONS_MANAGER,
  UserRole.FACILITY_MANAGER,
];

const AppSidebar: React.FC = () => {
  const { user, activeRole, logout, switchRole } = useAuth();
  const { setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();

  const currentRole = activeRole ?? user?.roles?.[0];
  const roleNavItems = currentRole ? (ROLE_NAV[currentRole] ?? []) : [];
  const canAccessOverview = Boolean(currentRole && OVERVIEW_ROLES.includes(currentRole));

  const allItems = canAccessOverview ? [OVERVIEW_ITEM, ...roleNavItems] : roleNavItems;
  const activePath =
    allItems.find((item) => location.pathname === item.to)?.to ??
    allItems
      .filter((item) => location.pathname.startsWith(`${item.to}/`))
      .sort((a, b) => b.to.length - a.to.length)[0]?.to;

  const go = (to: string) => {
    navigate(to);
    setOpenMobile(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSwitchRole = (newRole: UserRole) => {
    switchRole?.(newRole);
    go(getRoleDefaultPath(newRole));
  };

  return (
    <Sidebar>
      <Sidebar.Header>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-kumo-brand text-white flex items-center justify-center shrink-0">
            <Package className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <Text as="strong" bold>
              Storage Hub
            </Text>
            <div className="mt-0.5">
              <Badge variant="neutral">{getRoleTitle(currentRole)}</Badge>
            </div>
          </div>
        </div>
      </Sidebar.Header>

      <Sidebar.Content>
        {canAccessOverview && (
          <Sidebar.Group>
            <Sidebar.GroupLabel>Tổng quan</Sidebar.GroupLabel>
            <Sidebar.Menu>
              <Sidebar.MenuButton
                icon={OVERVIEW_ITEM.icon}
                active={activePath === OVERVIEW_ITEM.to}
                onClick={() => go(OVERVIEW_ITEM.to)}
              >
                {OVERVIEW_ITEM.label}
              </Sidebar.MenuButton>
            </Sidebar.Menu>
          </Sidebar.Group>
        )}

        <Sidebar.Group>
          <Sidebar.GroupLabel>Chức năng</Sidebar.GroupLabel>
          <Sidebar.Menu>
            {roleNavItems.map((item) => (
              <Sidebar.MenuButton
                key={item.to}
                icon={item.icon}
                active={activePath === item.to}
                onClick={() => go(item.to)}
              >
                {item.label}
              </Sidebar.MenuButton>
            ))}
          </Sidebar.Menu>
        </Sidebar.Group>

        {user?.roles && user.roles.length > 1 && (
          <Sidebar.Group>
            <Sidebar.GroupLabel>Vai trò làm việc</Sidebar.GroupLabel>
            <div className="px-2">
              <Select
                aria-label="Chuyển đổi vai trò người dùng"
                value={currentRole ?? null}
                onValueChange={(val) => handleSwitchRole(val as UserRole)}
                items={user.roles.map((r) => ({ value: r, label: getRoleTitle(r) }))}
              />
            </div>
          </Sidebar.Group>
        )}
      </Sidebar.Content>

      <Sidebar.Footer>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-kumo-fill ring ring-kumo-line flex items-center justify-center text-kumo-default shrink-0">
            {user?.fullName?.charAt(0).toUpperCase() || (
              <User className="w-4 h-4 text-kumo-subtle" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate">
              <Text as="strong" bold size="sm">
                {user?.fullName || 'Người dùng'}
              </Text>
            </div>
            <Text variant="secondary" size="xs" truncate>
              {user?.email || 'Chưa đăng nhập'}
            </Text>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<SignOut className="w-4 h-4" />}
            onClick={handleLogout}
            aria-label="Đăng xuất"
            title="Đăng xuất"
          />
        </div>
      </Sidebar.Footer>
    </Sidebar>
  );
};

export const AppShell: React.FC = () => {
  const { user } = useAuth();
  const { facilities, selectedFacility, selectFacility } = useFacility();

  return (
    <Sidebar.Provider defaultOpen className="h-svh bg-kumo-canvas text-kumo-default">
      <AppSidebar />

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-kumo-line bg-kumo-base px-4">
          <Sidebar.Trigger />

          {facilities.length > 0 && (
            <div className="w-56">
              <Select
                aria-label="Cơ sở đang quản lý"
                size="sm"
                value={selectedFacility?.id ?? ''}
                onValueChange={(val) => selectFacility(val as string)}
                items={facilities.map((f) => ({
                  value: f.id,
                  label: `${f.name} (${f.code})`,
                }))}
              />
            </div>
          )}

          <div className="ml-auto flex items-center gap-2 min-w-0">
            <Text variant="secondary" size="sm" truncate>
              {user?.fullName || 'Người dùng'}
            </Text>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </Sidebar.Provider>
  );
};
