import { Button, Text } from '@cloudflare/kumo';
import { UserRole } from '@storage/types';
import { Loader2 } from 'lucide-react';
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
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { AdminDashboard } from '../features/roles/AdminDashboard';
import { CustomerDashboard } from '../features/roles/CustomerDashboard';
import { FacilityManagerDashboard } from '../features/roles/FacilityManagerDashboard';
import { FacilityStaffDashboard } from '../features/roles/FacilityStaffDashboard';
import { OperationsDashboard } from '../features/roles/OperationsDashboard';
import { RoleLandingPage } from '../features/roles/RoleLandingPage';
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
          <Loader2 className="w-8 h-8 animate-spin text-kumo-brand" />
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
        <Loader2 className="w-8 h-8 animate-spin text-kumo-brand" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
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
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>

            <Route
              element={<RoleRoute allowedRoles={[UserRole.ADMIN, UserRole.OPERATIONS_MANAGER]} />}
            >
              <Route path="/operations" element={<OperationsDashboard />} />
            </Route>

            <Route
              element={<RoleRoute allowedRoles={[UserRole.ADMIN, UserRole.FACILITY_MANAGER]} />}
            >
              <Route path="/facility-manager" element={<FacilityManagerDashboard />} />
            </Route>

            <Route
              element={
                <RoleRoute
                  allowedRoles={[
                    UserRole.ADMIN,
                    UserRole.FACILITY_MANAGER,
                    UserRole.FACILITY_STAFF,
                  ]}
                />
              }
            >
              <Route path="/facility-staff" element={<FacilityStaffDashboard />} />
            </Route>

            <Route element={<RoleRoute allowedRoles={[UserRole.CUSTOMER, UserRole.ADMIN]} />}>
              <Route path="/customer" element={<CustomerDashboard />} />
            </Route>

            {/* General inventory and warehouse management */}
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/browse" element={<Navigate to="/dashboard" replace />} />
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
              <Link to="/dashboard">
                <Button variant="primary">Về trang chủ</Button>
              </Link>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};
