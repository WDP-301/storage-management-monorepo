import { UserRole } from '@storage/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../../context/AuthContext';
import { ChangeRequestsApi, WarehousesApi } from '../../lib/api';
import type { Warehouse } from '../../types/warehouse';
import { FacilityManagerDashboard } from './FacilityManagerDashboard';

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));
vi.mock('../../lib/toast', () => ({ useAppToast: () => toast }));

const wh = (over: Partial<Warehouse>): Warehouse => ({
  id: 'w-1',
  unitId: 'u-1',
  code: 'HCM-SG-01',
  name: 'Kho Sài Gòn',
  addressLine: '45 Lê Thánh Tôn',
  wardCode: null,
  provinceCode: null,
  latitude: 10,
  longitude: 106,
  widthM: 3,
  lengthM: 4,
  heightM: 2.8,
  areaM2: 12,
  volumeM3: 33.6,
  monthlyPrice: 3200000,
  depositMonths: null,
  effectiveDepositMonths: 1,
  status: 'AVAILABLE',
  notes: null,
  createdAt: '',
  updatedAt: '',
  ...over,
});

const mockAuth = (role: UserRole) =>
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    user: {
      id: 'u',
      email: 'm@demo.vn',
      fullName: 'Quản lý',
      status: 'ACTIVE',
      roles: [role],
      createdAt: '',
      updatedAt: '',
    },
    activeRole: role,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  } as unknown as ReturnType<typeof AuthContextModule.useAuth>);

const renderPage = () =>
  render(
    <MemoryRouter>
      <FacilityManagerDashboard />
    </MemoryRouter>,
  );

describe('FacilityManagerDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(ChangeRequestsApi, 'list').mockResolvedValue({
      requests: [],
      meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });
  });

  it('lists the manager warehouses and toggles maintenance via the status endpoint', async () => {
    mockAuth(UserRole.FACILITY_MANAGER);
    vi.spyOn(WarehousesApi, 'listMine').mockResolvedValue([
      wh({}),
      wh({ id: 'w-2', code: 'HCM-BC-01', name: 'Kho Bình Chánh', status: 'MAINTENANCE' }),
    ]);
    const updateStatus = vi
      .spyOn(WarehousesApi, 'updateStatus')
      .mockResolvedValue(wh({ status: 'MAINTENANCE' }));

    renderPage();
    await waitFor(() => expect(screen.getByText('Kho Sài Gòn')).toBeTruthy());
    expect(screen.getByText('Kho Bình Chánh')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /báo bảo trì/i }));
    await waitFor(() => expect(updateStatus).toHaveBeenCalledWith('w-1', 'MAINTENANCE'));
    await waitFor(() => expect(screen.getAllByText('Đang bảo trì').length).toBe(2));
  });

  it('uses the admin listing when the active role is ADMIN', async () => {
    mockAuth(UserRole.ADMIN);
    const listAdmin = vi.spyOn(WarehousesApi, 'listAdmin').mockResolvedValue({
      warehouses: [wh({})],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    const listMine = vi.spyOn(WarehousesApi, 'listMine');

    renderPage();
    await waitFor(() => expect(screen.getByText('Kho Sài Gòn')).toBeTruthy());
    expect(listAdmin).toHaveBeenCalled();
    expect(listMine).not.toHaveBeenCalled();
  });

  it('shows an empty state when no warehouse is assigned', async () => {
    mockAuth(UserRole.FACILITY_MANAGER);
    vi.spyOn(WarehousesApi, 'listMine').mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Chưa được gán kho')).toBeTruthy());
  });
});
