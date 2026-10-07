import { Button, Text } from '@cloudflare/kumo';
import { CircleNotch } from '@phosphor-icons/react';
import { UserRole } from '@storage/types';
import React from 'react';
import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthPage } from '../features/auth/AuthPage';
import { FacilityManagerDashboard } from '../features/roles/FacilityManagerDashboard';
import { RoleLandingPage } from '../features/roles/RoleLandingPage';
import { UnassignedRolePage } from '../features/roles/UnassignedRolePage';
import { SystemSettingsPage } from '../features/settings/SystemSettingsPage';
import { ManagerTicketsPage } from '../features/tickets/ManagerTicketsPage';
import { AppShell } from '../layouts/AppShell';
import { AuthLayout } from '../layouts/AuthLayout';
import { RoleRoute } from './RoleRoute';

/**
 * Route guard requiring active session authentication.
 */
export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kumo-base">
        <div className="flex flex-col items-center gap-3">
          <CircleNotch className="w-8 h-8 animate-spin text-kumo-brand" />
          <Text variant="secondary" size="xs">
            Đang kiểm tra phiên làm việc...
          </Text>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

/**
 * Route guard redirecting already authenticated users away from login/register.
 */
export const PublicOnlyRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kumo-base">
        <CircleNotch className="w-8 h-8 animate-spin text-kumo-brand" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Authentication Routes */}
        <Route element={<PublicOnlyRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<AuthPage initialMode="login" />} />
            <Route path="/register" element={<AuthPage initialMode="register" />} />
          </Route>
        </Route>

        {/* Protected App Shell Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            {/* Role-specific dedicated interfaces with guards */}
            <Route element={<RoleRoute allowedRoles={[UserRole.ADMIN]} />}>
              <Route path="/admin/settings" element={<SystemSettingsPage />} />
            </Route>

            <Route
              element={<RoleRoute allowedRoles={[UserRole.ADMIN, UserRole.FACILITY_MANAGER]} />}
            >
              <Route path="/facility-manager" element={<FacilityManagerDashboard />} />
              <Route path="/facility-manager/tickets" element={<ManagerTicketsPage />} />
            </Route>

            {/* Unassigned role fallback view (accessible to any authenticated user) */}
            <Route path="/unassigned-role" element={<UnassignedRolePage />} />

            <Route path="/" element={<RoleLandingPage />} />
          </Route>
        </Route>

        {/* Catch-all 404 Route */}
        <Route
          path="*"
          element={
            <div className="min-h-screen flex flex-col items-center justify-center bg-kumo-base p-6 text-center">
              <span className="text-4xl font-semibold text-kumo-default mb-2">404</span>
              <div className="mb-6">
                <Text variant="secondary" size="sm">
                  Trang bạn tìm kiếm không tồn tại.
                </Text>
              </div>
              <Link to="/">
                <Button variant="primary">Về trang chủ</Button>
              </Link>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};
