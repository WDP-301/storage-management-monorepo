import { Boxes } from 'lucide-react';
import React from 'react';
import { Outlet } from 'react-router-dom';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Brand Banner */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent text-accent-foreground shadow-xs mb-3">
            <Boxes className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Storage Management Hub
          </h1>
          <p className="text-sm text-muted mt-1">Cổng đăng nhập và quản lý kho tự quản</p>
        </div>

        {/* Auth Content Card */}
        <div className="bg-surface border border-border rounded-xl p-6 sm:p-8">
          <Outlet />
        </div>

        {/* Footer info & session note */}
        <div className="mt-6 flex flex-col items-center gap-2 text-center text-xs text-muted">
          <p>© 2026 Storage Management Monorepo. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};
