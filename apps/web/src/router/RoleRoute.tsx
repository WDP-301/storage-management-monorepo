import { Button, LayerCard, Text } from '@cloudflare/kumo';
import { UserRole } from '@storage/types';
import { ShieldAlert } from 'lucide-react';
import React from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoleDefaultPath, getRoleTitle, hasAllowedRole } from '../lib/roles';

interface RoleRouteProps {
  allowedRoles: UserRole[];
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kumo-base">
        <Text>Đang tải thông tin quyền truy cập...</Text>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isAuthorized = hasAllowedRole(user.roles, allowedRoles);

  if (!isAuthorized) {
    const userRole = user.roles[0];
    const userHome = getRoleDefaultPath(userRole);
    const userRoleTitle = getRoleTitle(userRole);
    const allowedTitles = allowedRoles.map(getRoleTitle).join(', ');

    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <LayerCard className="max-w-md w-full p-6 text-center ring ring-kumo-line">
          <div className="w-12 h-12 rounded-full bg-kumo-danger-tint text-kumo-danger flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>

          <div className="grid gap-1.5 mb-4">
            <Text as="h3" variant="heading">
              Quyền truy cập bị giới hạn
            </Text>
            <Text variant="secondary">
              Bạn đang đăng nhập với vai trò{' '}
              <Text as="strong" bold>
                {userRoleTitle}
              </Text>
              . Khu vực này chỉ dành cho vai trò:{' '}
              <Text as="strong" bold>
                {allowedTitles}
              </Text>
              .
            </Text>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <Button variant="primary" onClick={() => navigate(userHome, { replace: true })}>
              Về bảng điều khiển của tôi
            </Button>
          </div>
        </LayerCard>
      </div>
    );
  }

  return <Outlet />;
};
