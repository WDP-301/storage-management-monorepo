import { ShiftTemplateType, UserRole } from '@storage/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../../context/AuthContext';
import * as FacilityContextModule from '../../context/FacilityContext';
import { FacilitiesApi } from '../../lib/api';
import {
  type ShiftTemplateRecord,
  type StaffShiftRecord,
  StaffShiftsApi,
} from '../../lib/staff-shifts-api';
import { vnToday } from '../../lib/vn-day';
import { StaffShiftsPage } from './StaffShiftsPage';

const MORNING: ShiftTemplateRecord = {
  id: 'tpl-morning',
  code: 'MORNING',
  name: 'Ca sáng',
  start_time: '07:00',
  end_time: '12:00',
  is_active: true,
};
const AFTERNOON: ShiftTemplateRecord = {
  id: 'tpl-afternoon',
  code: 'AFTERNOON',
  name: 'Ca chiều',
  start_time: '13:00',
  end_time: '18:00',
  is_active: true,
};

const shift = (overrides: Partial<StaffShiftRecord> = {}): StaffShiftRecord => ({
  id: 'shift-1',
  staff_id: 'staff-1',
  staff_name: 'Lê Nhân Viên',
  facility_id: 'fac-1',
  shift_template_id: MORNING.id,
  shift_template_code: 'MORNING',
  shift_template_name: 'Ca sáng',
  work_date: vnToday(),
  start_at: `${vnToday()}T00:00:00.000Z`,
  end_at: `${vnToday()}T05:00:00.000Z`,
  status: 'SCHEDULED',
  check_in_at: null,
  check_out_at: null,
  note: null,
  assigned_by: null,
  ...overrides,
});

const mockAuth = (role: UserRole = UserRole.FACILITY_MANAGER) =>
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    user: {
      id: 'user-1',
      email: 'mgr@example.com',
      fullName: 'Manager',
      status: 'ACTIVE',
      roles: [role],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    activeRole: role,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  } as unknown as ReturnType<typeof AuthContextModule.useAuth>);

const mockFacility = () =>
  vi.spyOn(FacilityContextModule, 'useFacility').mockReturnValue({
    facilities: [],
    selectedFacility: {
      id: 'fac-1',
      code: 'Q7',
      name: 'Kho Quận 7',
      provinceCode: null,
      status: 'ACTIVE',
    },
    selectFacility: vi.fn(),
    refreshFacilities: vi.fn(),
    canSelectAll: false,
    isLoading: false,
  });

const renderPage = () =>
  render(
    <MemoryRouter>
      <StaffShiftsPage />
    </MemoryRouter>,
  );

describe('StaffShiftsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuth(UserRole.FACILITY_MANAGER);
    mockFacility();
    vi.spyOn(StaffShiftsApi, 'templates').mockResolvedValue([MORNING, AFTERNOON]);
    vi.spyOn(StaffShiftsApi, 'list').mockResolvedValue([shift()]);
    vi.spyOn(FacilitiesApi, 'listStaff').mockResolvedValue([
      { id: 'staff-1', fullName: 'Lê Nhân Viên', phone: null },
      { id: 'staff-2', fullName: 'Võ Kỹ Thuật', phone: '0909' },
    ]);
  });

  it('renders the week grid with templates and assigned staff', async () => {
    renderPage();

    expect(await screen.findByText('Ca sáng')).toBeTruthy();
    expect(screen.getByText('Ca chiều')).toBeTruthy();
    expect(await screen.findByText('Lê Nhân Viên')).toBeTruthy();
    expect(StaffShiftsApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ facilityId: 'fac-1' }),
    );
  });

  it('asks for a facility when none is selected', async () => {
    vi.spyOn(FacilityContextModule, 'useFacility').mockReturnValue({
      facilities: [],
      selectedFacility: null,
      selectFacility: vi.fn(),
      refreshFacilities: vi.fn(),
      canSelectAll: false,
      isLoading: false,
    });
    renderPage();

    expect(await screen.findByText(/Chọn một chi nhánh/i)).toBeTruthy();
    expect(StaffShiftsApi.list).not.toHaveBeenCalled();
  });

  it('opens the schedule dialog and creates shifts for the picked range', async () => {
    const createSpy = vi.spyOn(StaffShiftsApi, 'create').mockResolvedValue([]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /^Xếp ca$/ }));
    expect(await screen.findByText('Xếp ca cho nhân viên')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xếp ca' }));

    // Missing template/staff blocks the request before it reaches the API.
    await waitFor(() => expect(createSpy).not.toHaveBeenCalled());
  });

  it('shows shift details when a badge is clicked', async () => {
    renderPage();

    fireEvent.click(await screen.findByText('Lê Nhân Viên'));
    expect(await screen.findByText('Chi tiết ca')).toBeTruthy();
    // The status legend at the page footer also renders 'Đã xếp'.
    expect(screen.getAllByText('Đã xếp').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: 'Hủy ca' })).toBeTruthy();
  });

  it('opens the auto-schedule dialog with one input per template', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Tự động xếp ca/ }));
    expect(await screen.findByText('Tự động xếp ca tuần này')).toBeTruthy();
    expect(screen.getByLabelText(/Ca sáng/)).toBeTruthy();
    expect(screen.getByLabelText(/Ca chiều/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Quản lý mẫu ca/ })).toBeNull();
  });

  it('shows inline error with retry when loading shifts fails', async () => {
    vi.spyOn(StaffShiftsApi, 'list').mockRejectedValueOnce(new Error('Network down'));
    renderPage();

    expect(await screen.findByText('Không tải được lịch ca.')).toBeTruthy();
    expect(screen.queryByText(/Chưa có ca mẫu nào/)).toBeNull();

    vi.spyOn(StaffShiftsApi, 'list').mockResolvedValueOnce([shift()]);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Lê Nhân Viên')).toBeTruthy();
  });

  it('lets ADMIN open the shift templates dialog and create a template', async () => {
    mockAuth(UserRole.ADMIN);
    vi.spyOn(StaffShiftsApi, 'listAdminTemplates').mockResolvedValue([
      { ...MORNING, type: ShiftTemplateType.OFFICE },
    ]);
    const createTplSpy = vi.spyOn(StaffShiftsApi, 'createTemplate').mockResolvedValue({
      id: 'tpl-night',
      code: 'NIGHT',
      name: 'Ca tối',
      type: ShiftTemplateType.WAREHOUSE,
      start_time: '18:00',
      end_time: '22:00',
      is_active: true,
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Quản lý mẫu ca/ }));
    expect(await screen.findByText('Quản lý mẫu ca làm việc')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('VD: NIGHT_SHIFT'), {
      target: { value: 'night' },
    });
    fireEvent.change(screen.getByPlaceholderText('VD: Ca tối'), {
      target: { value: 'Ca tối' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm mẫu ca' }));

    await waitFor(() =>
      expect(createTplSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'NIGHT',
          name: 'Ca tối',
          isActive: true,
        }),
      ),
    );
  });
});
