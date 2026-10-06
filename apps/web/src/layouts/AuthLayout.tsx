import { LayerCard, Text } from '@cloudflare/kumo';
import { Package } from '@phosphor-icons/react';
import React from 'react';
import { Outlet } from 'react-router-dom';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-kumo-canvas flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-kumo-brand text-white flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <Text as="h1" variant="heading" size="lg">
              Storage Hub
            </Text>
            <div>
              <Text variant="secondary" size="sm">
                Cổng đăng nhập và quản lý kho tự quản
              </Text>
            </div>
          </div>
        </div>

        <LayerCard className="p-6 sm:p-8">
          <Outlet />
        </LayerCard>

        <div className="mt-6 text-center">
          <Text variant="secondary" size="xs">
            © 2026 Storage Management Monorepo
          </Text>
        </div>
      </div>
    </div>
  );
};
