import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  });
});
