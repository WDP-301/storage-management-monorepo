import { Button, LayerCard, Text } from '@cloudflare/kumo';
import { LogOut, RefreshCw, UserX } from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

/**
 * Fallback landing view for authenticated users whose account has no assigned roles.
 * Provides clear context and actions (Refresh permissions or Logout) with zero dead-ends.
 */
export const UnassignedRolePage: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshUser();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <LayerCard className="max-w-md w-full p-6 text-center ring ring-kumo-line">
        <div className="w-12 h-12 rounded-full bg-kumo-tint text-kumo-subtle flex items-center justify-center mx-auto mb-4">
          <UserX className="w-6 h-6 text-kumo-warning" />
        </div>

        <div className="grid gap-2 mb-6">
          <Text as="h3" variant="heading">
            Tài khoản chưa được phân quyền
          </Text>
          <Text variant="secondary" size="sm">
            Tài khoản{' '}
            <Text as="strong" bold>
              {user?.email || 'của bạn'}
            </Text>{' '}
            đã đăng nhập thành công nhưng hiện chưa được quản trị viên gán vai trò làm việc trong hệ
            thống.
          </Text>
          <Text variant="secondary" size="xs">
            Vui lòng liên hệ quản trị viên để được cấp quyền truy cập, sau đó bấm làm mới quyền.
          </Text>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <Button
            variant="secondary"
            loading={isRefreshing}
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={handleRefresh}
          >
            Làm mới quyền
          </Button>
          <Button
            variant="secondary-destructive"
            icon={<LogOut className="w-4 h-4" />}
            onClick={() => void logout()}
          >
            Đăng xuất
          </Button>
        </div>
      </LayerCard>
    </div>
  );
};
