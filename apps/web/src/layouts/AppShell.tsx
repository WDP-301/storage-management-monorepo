import { Badge, Button, Text } from '@cloudflare/kumo';
import { UserRole } from '@storage/types';
import { Boxes, LogOut, Menu, RefreshCw, ShieldCheck, User, X } from 'lucide-react';
import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoleDefaultPath, getRoleTitle } from '../lib/roles';

export const AppShell: React.FC = () => {
  const { user, activeRole, logout, switchRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const currentRole = activeRole ?? user?.roles?.[0];
  const roleTitle = getRoleTitle(currentRole);

  const getRoleBadgeClass = (role?: UserRole | null) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800';
      case UserRole.OPERATIONS_MANAGER:
        return 'bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
      case UserRole.FACILITY_MANAGER:
        return 'bg-teal-50 text-teal-800 border border-teal-200/80 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800';
      case UserRole.FACILITY_STAFF:
        return 'bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
      case UserRole.CUSTOMER:
        return 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
      default:
        return 'bg-kumo-fill text-kumo-subtle';
    }
  };

  const handleSwitchRole = (newRole: UserRole) => {
    switchRole?.(newRole);
    navigate(getRoleDefaultPath(newRole));
    setMobileMenuOpen(false);
  };

  const canAccessOverview = Boolean(
    currentRole &&
      (
        [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.FACILITY_MANAGER] as UserRole[]
      ).includes(currentRole),
  );

  // Navigation structure:
  // 1. Overview ("Tổng quan & Hàng tồn") at the top (for ADMIN, OPS, FACILITY_MANAGER)
  // 2. Role-specific functional modules below it
  const overviewItem = {
    to: '/dashboard',
    label: 'Tổng quan & Hàng tồn',
    badge: 'Chung',
  };

  const getRoleNavItems = () => {
    if (!currentRole) return [];
    if (currentRole === UserRole.ADMIN) {
      return [
        {
          to: '/admin',
          label: 'Quản trị hệ thống',
          badge: 'Admin',
        },
        {
          to: '/admin/settings',
          label: 'Cấu hình tham số',
          badge: 'Config',
        },
        {
          to: '/operations',
          label: 'Điều hành & Vận hành',
          badge: 'Ops',
        },
        {
          to: '/facility-manager',
          label: 'Quản lý cơ sở kho',
          badge: 'Manager',
        },
        {
          to: '/facility-manager/tickets',
          label: 'Sự cố & Ticket dịch vụ',
          badge: 'Tickets',
        },
        {
          to: '/facility-staff',
          label: 'Ca trực & Kiểm tra',
          badge: 'Staff',
        },
        {
          to: '/customer',
          label: 'Kho lưu trữ khách hàng',
          badge: 'Customer',
        },
      ];
    }

    if (currentRole === UserRole.OPERATIONS_MANAGER) {
      return [
        {
          to: '/operations',
          label: 'Điều hành & Vận hành',
          badge: 'Ops',
        },
        {
          to: '/admin/settings',
          label: 'Cấu hình tham số',
          badge: 'Config',
        },
      ];
    }

    if (currentRole === UserRole.FACILITY_MANAGER) {
      return [
        {
          to: '/facility-manager',
          label: 'Quản lý cơ sở kho',
          badge: 'Manager',
        },
        {
          to: '/facility-manager/tickets',
          label: 'Sự cố & Ticket dịch vụ',
          badge: 'Tickets',
        },
        {
          to: '/facility-staff',
          label: 'Ca trực & Kiểm tra',
          badge: 'Staff',
        },
      ];
    }

    if (currentRole === UserRole.FACILITY_STAFF) {
      return [
        {
          to: '/facility-staff',
          label: 'Ca trực & Kiểm tra',
          badge: 'Staff',
        },
      ];
    }

    return [
      {
        to: '/customer',
        label: 'Kho lưu trữ của tôi',
        badge: 'Customer',
      },
    ];
  };

  const roleNavItems = getRoleNavItems();
  const allNavItems = canAccessOverview ? [overviewItem, ...roleNavItems] : roleNavItems;
  const currentNav =
    allNavItems.find((item) => location.pathname === item.to) ||
    allNavItems
      .filter((item) => location.pathname.startsWith(`${item.to}/`))
      .sort((a, b) => b.to.length - a.to.length)[0];
  const pageTitle = currentNav ? currentNav.label : 'Hệ thống Quản lý Kho';

  return (
    <div className="min-h-screen bg-kumo-base text-kumo-default flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-kumo-control border-b border-kumo-line sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-kumo-brand text-white flex items-center justify-center font-semibold text-base">
            <Boxes className="w-5 h-5" />
          </div>
          <span className="font-semibold text-base">Storage Hub</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg text-kumo-subtle hover:text-kumo-default hover:bg-kumo-tint border border-kumo-line"
          aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Đóng menu điều hướng"
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-xs cursor-pointer border-none"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 z-50 md:z-30 h-screen w-72 bg-kumo-base border-r border-kumo-line flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="h-16 px-5 border-b border-kumo-line flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-kumo-brand text-white flex items-center justify-center font-semibold shadow-xs">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm">
                  <Text as="strong" bold>
                    Storage Hub
                  </Text>
                </span>
                <Badge
                  variant="neutral"
                  className={`text-[10px] font-medium border-none ${getRoleBadgeClass(currentRole)}`}
                >
                  {roleTitle}
                </Badge>
              </div>
              <Text variant="secondary" size="xs">
                Hệ thống kho tự quản
              </Text>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5" aria-label="Menu chính">
            {canAccessOverview && (
              <>
                <div className="px-3 py-1.5 flex items-center">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800">
                    <span className=" h-1.5 rounded-full shrink-0" />
                    Khu vực chung
                  </span>
                </div>
                <NavLink
                  to={overviewItem.to}
                  end
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }: { isActive: boolean }) =>
                    `block px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-semibold ring ring-blue-300/40'
                        : 'text-kumo-subtle hover:text-kumo-default hover:bg-kumo-tint'
                    }`
                  }
                >
                  {overviewItem.label}
                </NavLink>
              </>
            )}

            {roleNavItems.length > 0 && (
              <>
                <div className={`${canAccessOverview ? 'pt-4' : ''} px-3 py-1.5 flex items-center`}>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800">
                    <span className="h-1.5 rounded-full shrink-0" />
                    Chức năng theo vai trò
                  </span>
                </div>
                {roleNavItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }: { isActive: boolean }) =>
                      `block px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-kumo-fill text-kumo-brand font-semibold ring ring-kumo-brand/20'
                          : 'text-kumo-subtle hover:text-kumo-default hover:bg-kumo-tint'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </>
            )}

            {!canAccessOverview && roleNavItems.length === 0 && (
              <div className="px-3 py-2 text-xs text-kumo-subtle italic">
                Chưa có chức năng vai trò
              </div>
            )}
          </nav>

          {/* Multi-role Switcher (only for accounts with multiple assigned roles) */}
          {user?.roles && user.roles.length > 1 && (
            <div className="mx-4 p-3 rounded-lg bg-kumo-tint/60 border border-kumo-line space-y-2">
              <span className="text-xs font-medium text-kumo-default flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 text-kumo-brand" />
                <span>Chuyển vai trò làm việc</span>
              </span>
              <select
                aria-label="Chuyển đổi vai trò người dùng"
                value={currentRole}
                onChange={(e) => handleSwitchRole(e.target.value as UserRole)}
                className="w-full h-8 text-xs px-2 rounded-md bg-kumo-base border border-kumo-line text-kumo-default"
              >
                {user.roles.map((r) => (
                  <option key={r} value={r}>
                    {getRoleTitle(r)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-kumo-line bg-kumo-control/40">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-kumo-fill border border-kumo-line flex items-center justify-center text-kumo-default font-semibold text-xs shrink-0">
                {user?.fullName?.charAt(0).toUpperCase() || (
                  <User className="w-4 h-4 text-kumo-subtle" />
                )}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-kumo-default truncate">
                  {user?.fullName || 'Người dùng'}
                </p>
                <p className="text-[11px] text-kumo-subtle truncate mt-0.5">
                  {user?.email || 'Chưa đăng nhập'}
                </p>
              </div>
            </div>
            <Badge
              variant="neutral"
              className={`shrink-0 text-[10px] font-medium border-none ${getRoleBadgeClass(currentRole)}`}
            >
              {roleTitle}
            </Badge>
          </div>

          <Button
            variant="secondary-destructive"
            size="sm"
            className="w-full justify-center"
            icon={<LogOut className="w-3.5 h-3.5" />}
            onClick={handleLogout}
          >
            Đăng xuất
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 px-6 bg-kumo-base border-b border-kumo-line sticky top-0 z-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Text as="h2">{pageTitle}</Text>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-kumo-tint border border-kumo-line rounded-full text-xs font-medium text-kumo-default">
              <span className="w-2 h-2 rounded-full bg-kumo-success animate-pulse" />
              <ShieldCheck className="w-3.5 h-3.5 text-kumo-brand" />
              <span>Phiên làm việc bảo mật ({roleTitle})</span>
            </div>

            <div className="flex items-center gap-2 pl-2 border-l border-kumo-line">
              <span className="hidden md:inline">
                <Text variant="secondary" size="xs">
                  Xin chào,
                </Text>
              </span>
              <span className="text-xs truncate max-w-[140px]">
                <Text as="strong" bold>
                  {user?.fullName || 'Người dùng'}
                </Text>
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
