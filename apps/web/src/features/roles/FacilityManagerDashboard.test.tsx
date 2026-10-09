import { UserRole } from '@storage/types';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../../context/AuthContext';
import * as FacilityContextModule from '../../context/FacilityContext';
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

// MapLibre needs WebGL; the stub exposes what the page passes to the map.
vi.mock('../warehouses/WarehouseOverviewMap', () => ({
  WarehouseOverviewMap: ({
    warehouses,
    focusedWarehouseId,
    renderActions,
  }: {
    warehouses: Warehouse[];
    focusedWarehouseId: string | null;
    renderActions: (w: Warehouse) => React.ReactNode;
  }) => {
    const focused = warehouses.find((w) => w.id === focusedWarehouseId);
    return (
      <section aria-label="Bản đồ kho (stub)">
        {warehouses.map((w) => (
          <span key={w.id}>{`ghim ${w.code}`}</span>
        ))}
        {focused && renderActions(focused)}
      </section>
    );
  },
}));

const wh = (over: Partial<Warehouse>): Warehouse => ({
  id: 'w-1',
  facility: { id: 'fac-1', code: 'CN-HCM', name: 'Cơ sở Hồ Chí Minh' },
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
    logout: vi.fn(),
    refreshUser: vi.fn(),
  } as unknown as ReturnType<typeof AuthContextModule.useAuth>);

const FAC_HCM = {
  id: 'fac-1',
  code: 'CN-HCM',
  name: 'Cơ sở Hồ Chí Minh',
  provinceCode: '79',
  status: 'ACTIVE',
};

const mockFacility = (selected: typeof FAC_HCM | null, canSelectAll = false) =>
  vi.spyOn(FacilityContextModule, 'useFacility').mockReturnValue({
    facilities: selected ? [selected] : [],
    selectedFacility: selected,
    selectFacility: vi.fn(),
    refreshFacilities: vi.fn(),
    canSelectAll,
    isLoading: false,
  });

const renderPage = () =>
  render(
    <MemoryRouter>
      <FacilityManagerDashboard />
    </MemoryRouter>,
  );

describe('FacilityManagerDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFacility(FAC_HCM);
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

  it('shows the facility warehouses on the map with the maintenance action', async () => {
    mockAuth(UserRole.FACILITY_MANAGER);
    vi.spyOn(WarehousesApi, 'listMine').mockResolvedValue([
      wh({}),
      wh({ id: 'w-2', code: 'HCM-BC-01', name: 'Kho Bình Chánh', status: 'RENTED' }),
    ]);
    const updateStatus = vi
      .spyOn(WarehousesApi, 'updateStatus')
      .mockResolvedValue(wh({ status: 'MAINTENANCE' }));

    renderPage();
    await waitFor(() => expect(screen.getByText('Kho Sài Gòn')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Xem kho HCM-SG-01 trên bản đồ' }));
    const map = screen.getByRole('region', { name: 'Bản đồ kho (stub)' });
    expect(screen.queryByText('Kho Sài Gòn')).toBeNull();
    expect(map.textContent).toContain('ghim HCM-SG-01');
    expect(map.textContent).toContain('ghim HCM-BC-01');

    fireEvent.click(within(map).getByRole('button', { name: /báo bảo trì/i }));
    await waitFor(() => expect(updateStatus).toHaveBeenCalledWith('w-1', 'MAINTENANCE'));

    fireEvent.click(screen.getByRole('button', { name: 'Danh sách' }));
    expect(screen.getByText('Kho Sài Gòn')).toBeTruthy();
  });

  it('applies the search filter to the map as well', async () => {
    mockAuth(UserRole.FACILITY_MANAGER);
    vi.spyOn(WarehousesApi, 'listMine').mockResolvedValue([
      wh({}),
      wh({ id: 'w-2', code: 'HCM-BC-01', name: 'Kho Bình Chánh' }),
    ]);

    renderPage();
    await waitFor(() => expect(screen.getByText('Kho Sài Gòn')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Tìm mã kho hoặc tên kho'), {
      target: { value: 'BC' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Bản đồ' }));

    const map = screen.getByRole('region', { name: 'Bản đồ kho (stub)' });
    expect(map.textContent).toContain('ghim HCM-BC-01');
    expect(map.textContent).not.toContain('ghim HCM-SG-01');
  });

  it('explains that a warehouse toggled out of the status filter is now hidden', async () => {
    mockAuth(UserRole.FACILITY_MANAGER);
    vi.spyOn(WarehousesApi, 'listMine').mockResolvedValue([
      wh({}),
      wh({ id: 'w-2', code: 'HCM-BC-01', name: 'Kho Bình Chánh', status: 'RENTED' }),
    ]);
    vi.spyOn(WarehousesApi, 'updateStatus').mockResolvedValue(wh({ status: 'MAINTENANCE' }));

    renderPage();
    await waitFor(() => expect(screen.getByText('Kho Sài Gòn')).toBeTruthy());
    fireEvent.click(screen.getByRole('combobox', { name: 'Lọc trạng thái kho' }));
    // The select commits an option on a pointer press/release, not on a bare click.
    const option = await screen.findByRole('option', { name: 'Còn trống' });
    fireEvent.pointerDown(option, { pointerType: 'mouse' });
    fireEvent.pointerUp(option, { pointerType: 'mouse' });
    fireEvent.click(option);
    await waitFor(() => expect(screen.queryByText('Kho Bình Chánh')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /báo bảo trì/i }));
    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith(
        'Cập nhật trạng thái kho',
        'Đã cập nhật kho HCM-SG-01 thành: Đang bảo trì. Kho không còn khớp bộ lọc trạng thái nên đã được ẩn.',
      ),
    );
    await waitFor(() => expect(screen.queryByText('Kho Sài Gòn')).toBeNull());
  });

  it('keeps the plain message when the toggled warehouse still matches the filter', async () => {
    mockAuth(UserRole.FACILITY_MANAGER);
    vi.spyOn(WarehousesApi, 'listMine').mockResolvedValue([wh({})]);
    vi.spyOn(WarehousesApi, 'updateStatus').mockResolvedValue(wh({ status: 'MAINTENANCE' }));

    renderPage();
    await waitFor(() => expect(screen.getByText('Kho Sài Gòn')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /báo bảo trì/i }));
    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith(
        'Cập nhật trạng thái kho',
        'Đã cập nhật kho HCM-SG-01 thành: Đang bảo trì',
      ),
    );
  });

  it('forgets the focused warehouse when the manager switches facility', async () => {
    mockAuth(UserRole.FACILITY_MANAGER);
    vi.spyOn(WarehousesApi, 'listMine').mockResolvedValue([wh({})]);

    const view = renderPage();
    await waitFor(() => expect(screen.getByText('Kho Sài Gòn')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Xem kho HCM-SG-01 trên bản đồ' }));
    const map = screen.getByRole('region', { name: 'Bản đồ kho (stub)' });
    expect(within(map).getByRole('button', { name: /báo bảo trì/i })).toBeTruthy();

    mockFacility({ ...FAC_HCM, id: 'fac-2', name: 'Cơ sở Đà Nẵng' });
    view.rerender(
      <MemoryRouter>
        <FacilityManagerDashboard />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(vi.mocked(WarehousesApi.listMine)).toHaveBeenLastCalledWith({ facilityId: 'fac-2' }),
    );
    const reloaded = await screen.findByRole('region', { name: 'Bản đồ kho (stub)' });
    expect(within(reloaded).queryByRole('button', { name: /báo bảo trì/i })).toBeNull();
  });

  it('uses the admin listing when the active role is ADMIN', async () => {
    mockAuth(UserRole.ADMIN);
    mockFacility(null, true);
    const listAdmin = vi.spyOn(WarehousesApi, 'listAdmin').mockResolvedValue({
      warehouses: [wh({})],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    const listMine = vi.spyOn(WarehousesApi, 'listMine');

    renderPage();
    await waitFor(() => expect(screen.getByText('Kho Sài Gòn')).toBeTruthy());
    expect(listAdmin).toHaveBeenCalledWith(expect.objectContaining({ facilityId: undefined }));
    expect(listMine).not.toHaveBeenCalled();
  });

  it('scopes the manager listing to the selected facility', async () => {
    mockAuth(UserRole.FACILITY_MANAGER);
    const listMine = vi.spyOn(WarehousesApi, 'listMine').mockResolvedValue([wh({})]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Kho Sài Gòn')).toBeTruthy());
    expect(listMine).toHaveBeenCalledWith({ facilityId: 'fac-1' });
  });

  it('keeps only change requests leaving the selected facility', async () => {
    mockAuth(UserRole.FACILITY_MANAGER);
    vi.spyOn(WarehousesApi, 'listMine').mockResolvedValue([wh({})]);
    const request = (id: string, facility_id: string) => ({
      id,
      status: 'REQUESTED' as const,
      reason: `lý do ${id}`,
      rent_difference: 0,
      decision_note: null,
      facility_id,
      created_at: '2026-10-01T00:00:00.000Z',
      requester: { id: 'c', full_name: `Khách ${id}`, email: 'c@x.vn' },
      old_unit: { id: 'u1', code: 'A-1' },
      new_unit: { id: 'u2', code: 'B-1' },
    });
    vi.spyOn(ChangeRequestsApi, 'list').mockResolvedValue({
      requests: [request('mine', 'fac-1'), request('other', 'fac-2')],
      meta: { page: 1, limit: 50, total: 2, totalPages: 1 },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Khách mine')).toBeTruthy());
    expect(screen.queryByText('Khách other')).toBeNull();
  });

  it('refetches and shows a Vietnamese message when toggling maintenance fails', async () => {
    mockAuth(UserRole.FACILITY_MANAGER);
    const listMine = vi.spyOn(WarehousesApi, 'listMine').mockResolvedValue([wh({})]);
    vi.spyOn(WarehousesApi, 'updateStatus').mockRejectedValue(
      Object.assign(new Error('Conflict'), { status: 409 }),
    );
    renderPage();
    await waitFor(() => expect(screen.getByText('Kho Sài Gòn')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /báo bảo trì/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Không cập nhật được trạng thái kho',
        expect.stringContaining('đã được làm mới'),
      ),
    );
    await waitFor(() => expect(listMine).toHaveBeenCalledTimes(2));
  });

  it('shows an empty state when no warehouse is assigned', async () => {
    mockAuth(UserRole.FACILITY_MANAGER);
    vi.spyOn(WarehousesApi, 'listMine').mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Cơ sở chưa có kho')).toBeTruthy());
  });
});
