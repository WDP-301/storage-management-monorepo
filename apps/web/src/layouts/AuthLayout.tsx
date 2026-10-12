import { LayerCard, Text } from '@cloudflare/kumo';
import { Package } from '@phosphor-icons/react';
import React from 'react';
import { Outlet } from 'react-router-dom';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-kumo-canvas flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Brand Banner - Centered */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-kumo-brand text-white flex items-center justify-center shadow-sm mb-3">
            <Package className="w-6 h-6" />
          </div>
          <Text as="h1" variant="heading" size="lg">
            Storage Hub
          </Text>
          <div className="mt-1">
            <Text variant="secondary" size="sm">
              Cổng đăng nhập và quản lý kho tự quản
            </Text>
          </div>
        </div>

        {/* Auth Content Card */}
        <LayerCard className="p-6 sm:p-8 shadow-sm">
          <Outlet />
        </LayerCard>

        {/* Footer */}
        <div className="mt-6 text-center">
          <Text variant="secondary" size="xs">
            © 2026 Storage Management Monorepo
          </Text>
        </div>
      </div>
    </div>
  );
};
