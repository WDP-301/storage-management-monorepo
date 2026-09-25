import { Boxes, LayoutDashboard, LogOut, Menu, ShieldCheck, User, X } from 'lucide-react';
import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../design-system/Badge';

export const AppShell: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    {
      to: '/dashboard',
      label: 'Tổng quan & Hàng tồn',
      icon: <LayoutDashboard className="w-4 h-4" />,
      description: 'Quản lý kho hàng và khu vực lưu trữ',
    },
  ];

  // Derive current page title
  const currentNav = navItems.find((item) => location.pathname.startsWith(item.to));
  const pageTitle = currentNav ? currentNav.label : 'Hệ thống Quản lý Kho';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-surface border-b border-border sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent text-accent-foreground flex items-center justify-center font-bold text-base">
            <Boxes className="w-5 h-5" />
          </div>
          <span className="font-bold text-base tracking-tight">Storage Hub</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary border border-border"
          aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Đóng menu điều hướng"
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-xs transition-opacity cursor-pointer border-none"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Desktop fixed + Mobile slide-out) */}
      <aside
        className={`fixed md:sticky top-0 z-50 md:z-30 h-screen w-72 bg-surface border-r border-border flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div>
          <div className="h-16 px-6 border-b border-separator/60 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent text-accent-foreground flex items-center justify-center font-bold shadow-xs">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight leading-tight">Storage Hub</h1>
              <p className="text-[11px] text-muted font-medium">Hệ thống kho tự quản</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5" aria-label="Menu chính">
            <div className="px-3 py-2 text-[11px] font-bold text-muted uppercase tracking-wider">
              Khám phá & Quản trị
            </div>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }: { isActive: boolean }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-accent/10 text-accent border border-accent/20'
                      : 'text-muted hover:text-foreground hover:bg-surface-secondary'
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-separator/60 bg-surface-secondary/30">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-surface-tertiary border border-border flex items-center justify-center text-foreground font-semibold text-xs shrink-0">
                {user?.fullName?.charAt(0).toUpperCase() || <User className="w-4 h-4 text-muted" />}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-foreground truncate leading-tight">
                  {user?.fullName || 'Khách vãng lai'}
                </p>
                <p className="text-[11px] text-muted truncate leading-tight mt-0.5">
                  {user?.email || 'Chưa đăng nhập'}
                </p>
              </div>
            </div>
            {user?.roles?.[0] && (
              <Badge variant="accent" className="shrink-0 text-[10px]">
                {user.roles[0] === 'CUSTOMER' ? 'Khách' : 'Nhân sự'}
              </Badge>
            )}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-danger bg-danger/5 hover:bg-danger/10 border border-danger/20 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng xuất (Hủy phiên)</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 px-6 bg-surface border-b border-border sticky top-0 z-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-foreground">{pageTitle}</h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Session Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-surface-secondary border border-border rounded-full text-xs font-medium text-foreground">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <ShieldCheck className="w-3.5 h-3.5 text-accent" />
              <span>Phiên làm việc bảo mật (Session)</span>
            </div>

            <div className="flex items-center gap-2 pl-2 border-l border-separator">
              <span className="text-xs text-muted hidden md:inline">Xin chào,</span>
              <span className="text-xs font-bold text-foreground truncate max-w-[120px]">
                {user?.fullName || 'Người dùng'}
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
