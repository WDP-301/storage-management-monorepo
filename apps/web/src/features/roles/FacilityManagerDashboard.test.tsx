import { UserRole } from '@storage/types';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../../context/AuthContext';
import * as FacilityContextModule from '../../context/FacilityContext';
import { ChangeRequestsApi, WarehousesApi } from '../../lib/api';
import { MoveSlotsApi } from '../../lib/move-slots-api';
import { addDays, vnToday } from '../../lib/vn-day';
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
  facility: { id: 'fac-1', code: 'CN-HCM', name: 'Chi nhánh Hồ Chí Minh' },
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
  images: [],
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
  name: 'Chi nhánh Hồ Chí Minh',
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

    mockFacility({ ...FAC_HCM, id: 'fac-2', name: 'Chi nhánh Đà Nẵng' });
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
    const request = (id: string, facility_id: string, dest_facility_id?: string) => ({
      id,
      status: 'REQUESTED' as const,
      reason: `lý do ${id}`,
      rent_difference: 0,
      deposit_difference: 0,
      decision_note: null,
      facility_id,
      move_at: '2026-11-20T12:00:00.000Z',
      transition_start_at: null,
      transition_end_at: null,
      topup_invoice_id: null,
      new_contract_id: null,
      new_booking_id: null,
      settled_at: null,
      final_approved_by: null,
      final_approved_at: null,
      created_at: '2026-10-01T00:00:00.000Z',
      requester: { id: 'c', full_name: `Khách ${id}`, email: 'c@x.vn' },
      old_unit: { id: 'u1', code: 'A-1', facility_id },
      new_unit: { id: 'u2', code: 'B-1', facility_id: dest_facility_id ?? facility_id },
    });
    vi.spyOn(ChangeRequestsApi, 'list').mockResolvedValue({
      requests: [
        request('mine', 'fac-1'),
        request('other', 'fac-2'),
        request('incoming', 'fac-2', 'fac-1'),
      ],
      meta: { page: 1, limit: 50, total: 2, totalPages: 1 },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Khách mine')).toBeTruthy());
    expect(screen.queryByText('Khách other')).toBeNull();
    // A request entering this facility as the destination is also visible here.
    expect(screen.getByText('Khách incoming')).toBeTruthy();
  });

  it('offers the final approval action for a settled move and counts it as "Cần chốt cuối"', async () => {
    mockAuth(UserRole.FACILITY_MANAGER);
    vi.spyOn(WarehousesApi, 'listMine').mockResolvedValue([wh({})]);
    const settled = {
      id: 'req-final',
      status: 'AWAITING_FINAL_APPROVAL' as const,
      reason: 'đổi kho mới',
      rent_difference: 0,
      deposit_difference: 0,
      decision_note: null,
      facility_id: 'fac-1',
      move_at: '2026-11-20T12:00:00.000Z',
      transition_start_at: null,
      transition_end_at: null,
      topup_invoice_id: null,
      new_contract_id: 'c-2',
      new_booking_id: 'b-2',
      settled_at: '2026-11-19T00:00:00.000Z',
      final_approved_by: null,
      final_approved_at: null,
      created_at: '2026-10-01T00:00:00.000Z',
      requester: { id: 'c', full_name: 'Khách chốt', email: 'c@x.vn' },
      old_unit: { id: 'u1', code: 'A-1', facility_id: 'fac-1' },
      new_unit: { id: 'u2', code: 'B-1', facility_id: 'fac-1' },
    };
    vi.spyOn(ChangeRequestsApi, 'list').mockResolvedValue({
      requests: [settled],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });
    const finalApprove = vi
      .spyOn(ChangeRequestsApi, 'finalApprove')
      .mockResolvedValue({ request: { ...settled, status: 'COMPLETED', final_approved_by: 'u' } });

    renderPage();
    await waitFor(() => expect(screen.getByText('Khách chốt')).toBeTruthy());
    // The new KPI card surfaces the move waiting on the manager's final sign-off.
    expect(screen.getByText('Cần chốt cuối')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hoàn tất' }));
    await waitFor(() => expect(finalApprove).toHaveBeenCalledWith('req-final'));
    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith(
        'Cập nhật đổi kho',
        'Đã hoàn tất — kho cũ chuyển bảo trì, yêu cầu khép lại.',
      ),
    );
  });

  it("approves with the customer's in-shift hour on the proposed day", async () => {
    mockAuth(UserRole.FACILITY_MANAGER);
    vi.spyOn(WarehousesApi, 'listMine').mockResolvedValue([wh({})]);
    const day = addDays(vnToday(), 3);
    const at = (time: string) => new Date(`${day}T${time}:00+07:00`).toISOString();
    const pending = {
      id: 'req-approve',
      status: 'REQUESTED' as const,
      reason: 'cần kho rộng hơn',
      rent_difference: 0,
      deposit_difference: 0,
      decision_note: null,
      facility_id: 'fac-1',
      move_at: at('14:00'),
      transition_start_at: null,
      transition_end_at: null,
      topup_invoice_id: null,
      new_contract_id: null,
      new_booking_id: null,
      settled_at: null,
      final_approved_by: null,
      final_approved_at: null,
      created_at: '2026-10-01T00:00:00.000Z',
      requester: { id: 'c', full_name: 'Khách duyệt', email: 'c@x.vn' },
      old_unit: { id: 'u1', code: 'A-1', facility_id: 'fac-1' },
      new_unit: { id: 'u2', code: 'B-1', facility_id: 'fac-1' },
    };
    vi.spyOn(ChangeRequestsApi, 'list').mockResolvedValue({
      requests: [pending],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });
    vi.spyOn(MoveSlotsApi, 'unitChangeWindow').mockResolvedValue({
      minLeadDays: 1,
      maxDaysAhead: 90,
    });
    const windows = vi
      .spyOn(MoveSlotsApi, 'windows')
      .mockResolvedValue([{ startAt: at('08:00'), endAt: at('17:00') }]);
    const decide = vi
      .spyOn(ChangeRequestsApi, 'decide')
      .mockResolvedValue({ request: { ...pending, status: 'AWAITING_HANDOVER' } });

    renderPage();
    await waitFor(() => expect(screen.getByText('Khách duyệt')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Duyệt' }));
    await waitFor(() => expect(windows).toHaveBeenCalledWith(day));
    const submit = await screen.findByRole('button', { name: 'Duyệt và giữ chỗ' });
    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(submit);

    await waitFor(() =>
      expect(decide).toHaveBeenCalledWith('req-approve', 'APPROVED', {
        moveAt: at('14:00'),
        decisionNote: undefined,
      }),
    );
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
    await waitFor(() => expect(screen.getByText('Chi nhánh chưa có kho')).toBeTruthy());
  });
});
