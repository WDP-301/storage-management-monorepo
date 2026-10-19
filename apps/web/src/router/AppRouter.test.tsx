import { UserRole } from '@storage/types';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../context/AuthContext';
import { AmenitiesApi } from '../lib/amenities-api';
import { AppRouter, ProtectedRoute, PublicOnlyRoute } from './AppRouter';

vi.mock('../context/FacilityContext', () => ({
  useFacility: () => ({
    facilities: [],
    selectedFacility: null,
    selectFacility: vi.fn(),
    canSelectAll: false,
    refreshFacilities: vi.fn(),
  }),
}));

describe('AppRouter Route Guards and 404', () => {
  it('redirects unauthenticated users to /login when accessing protected routes', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Protected Dashboard</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page Target</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Login Page Target')).toBeTruthy();
    expect(screen.queryByText('Protected Dashboard')).toBeNull();
  });

  it('redirects authenticated users away from public-only auth routes', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'usr-1',
        email: 'user@example.com',
        fullName: 'Logged User',
        status: 'ACTIVE',
        roles: ['CUSTOMER'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<div>Login Form</div>} />
          </Route>
          <Route path="/" element={<div>Dashboard Home</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Dashboard Home')).toBeTruthy();
    expect(screen.queryByText('Login Form')).toBeNull();
  });

  it('keeps the amenity catalog away from operations managers', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'usr-ops',
        email: 'ops@example.com',
        fullName: 'Ops Manager',
        status: 'ACTIVE',
        roles: [UserRole.OPERATIONS_MANAGER],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      activeRole: UserRole.OPERATIONS_MANAGER,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    } as unknown as ReturnType<typeof AuthContextModule.useAuth>);
    const listAdmin = vi.spyOn(AmenitiesApi, 'listAdmin').mockResolvedValue([]);
    window.history.pushState({}, '', '/admin/amenities');

    render(<AppRouter />);

    expect(screen.getByText('Quyền truy cập bị giới hạn')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Tiện ích kho' })).toBeNull();
    expect(listAdmin).not.toHaveBeenCalled();
  });
});
