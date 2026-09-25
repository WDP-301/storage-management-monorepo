import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../context/AuthContext';
import { ProtectedRoute, PublicOnlyRoute } from './AppRouter';

describe('AppRouter Route Guards and 404', () => {
  it('redirects unauthenticated users to /login when accessing protected routes', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
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
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<div>Login Form</div>} />
          </Route>
          <Route path="/dashboard" element={<div>Dashboard Home</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Dashboard Home')).toBeTruthy();
    expect(screen.queryByText('Login Form')).toBeNull();
  });
});
