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
import { AppShell } from '../layouts/AppShell';
import { AuthLayout } from '../layouts/AuthLayout';

/**
 * Route guard requiring active session authentication.
 */
export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-xs text-muted font-medium">Đang kiểm tra phiên làm việc...</p>
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
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
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/browse" element={<Navigate to="/dashboard" replace />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>

        {/* Catch-all 404 Route */}
        <Route
          path="*"
          element={
            <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
              <h1 className="text-4xl font-extrabold text-foreground mb-2">404</h1>
              <p className="text-sm text-muted mb-6">Trang bạn tìm kiếm không tồn tại.</p>
              <Link
                to="/dashboard"
                className="px-4 py-2 bg-accent text-accent-foreground font-semibold rounded-lg text-sm hover:opacity-90 transition"
              >
                Về trang chủ
              </Link>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};
