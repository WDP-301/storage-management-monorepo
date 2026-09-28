import { UserRole } from '@storage/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../context/AuthContext';
import { RoleRoute } from './RoleRoute';

describe('RoleRoute RBAC Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders child route when user has the allowed role', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'usr-admin',
        email: 'admin@storage.vn',
        fullName: 'Admin User',
        status: 'ACTIVE',
        roles: [UserRole.ADMIN],
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
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<RoleRoute allowedRoles={[UserRole.ADMIN]} />}>
            <Route path="/admin" element={<div>Admin Secret Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Admin Secret Dashboard')).toBeTruthy();
  });

  it('blocks access and displays Kumo warning when user lacks the required role', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'usr-customer',
        email: 'customer@storage.vn',
        fullName: 'Customer Test',
        status: 'ACTIVE',
        roles: [UserRole.CUSTOMER],
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
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<RoleRoute allowedRoles={[UserRole.ADMIN]} />}>
            <Route path="/admin" element={<div>Admin Secret Dashboard</div>} />
          </Route>
          <Route path="/customer" element={<div>Customer Dashboard Target</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Admin Secret Dashboard')).toBeNull();
    expect(screen.getByText('Quyền truy cập bị giới hạn')).toBeTruthy();
    expect(screen.getByRole('button', { name: /về bảng điều khiển của tôi/i })).toBeTruthy();
  });

  it('navigates back to user home when clicking return button', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'usr-staff',
        email: 'staff@storage.vn',
        fullName: 'Staff Test',
        status: 'ACTIVE',
        roles: [UserRole.FACILITY_STAFF],
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
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<RoleRoute allowedRoles={[UserRole.ADMIN]} />}>
            <Route path="/admin" element={<div>Admin Secret Dashboard</div>} />
          </Route>
          <Route path="/facility-staff" element={<div>Staff Target Home</div>} />
        </Routes>
      </MemoryRouter>,
    );

    const backBtn = screen.getByRole('button', { name: /về bảng điều khiển của tôi/i });
    fireEvent.click(backBtn);

    expect(screen.getByText('Staff Target Home')).toBeTruthy();
  });

  it('renders unassigned role warning when user has empty roles list', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'usr-unassigned',
        email: 'newuser@storage.vn',
        fullName: 'New User',
        status: 'ACTIVE',
        roles: [],
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
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<RoleRoute allowedRoles={[UserRole.ADMIN]} />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Tài khoản chưa được phân quyền')).toBeTruthy();
    expect(screen.getByRole('button', { name: /xem trạng thái tài khoản/i })).toBeTruthy();
  });

  it('navigates to unassigned role path when clicking action button for unassigned user', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'usr-unassigned',
        email: 'newuser@storage.vn',
        fullName: 'New User',
        status: 'ACTIVE',
        roles: [],
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
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<RoleRoute allowedRoles={[UserRole.ADMIN]} />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Route>
          <Route path="/unassigned-role" element={<div>Unassigned Role Page Screen</div>} />
        </Routes>
      </MemoryRouter>,
    );

    const actionBtn = screen.getByRole('button', { name: /xem trạng thái tài khoản/i });
    fireEvent.click(actionBtn);

    expect(screen.getByText('Unassigned Role Page Screen')).toBeTruthy();
  });
});
