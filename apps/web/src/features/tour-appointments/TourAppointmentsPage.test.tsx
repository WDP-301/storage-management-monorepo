import type { TourAppointmentRecord } from '@storage/types';
import { TourAppointmentStatus, UserRole } from '@storage/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../../context/AuthContext';
import * as FacilityContextModule from '../../context/FacilityContext';
import { FacilitiesApi } from '../../lib/api';
import { TourAppointmentsApi } from '../../lib/tour-appointments-api';
import { TourAppointmentsPage } from './TourAppointmentsPage';

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));
vi.mock('../../lib/toast', () => ({ useAppToast: () => toast }));

const mockAppointments: TourAppointmentRecord[] = [
  {
    id: 'apt-1',
    facilityId: 'fac-1',
    storageUnitId: 'unit-1',
    customerId: 'cust-1',
    fullName: 'Nguyễn Văn A',
    phone: '0901234567',
    email: 'nva@example.com',
    preferredDate: '2026-11-20',
    preferredTimeSlot: '09:00 - 10:00',
    customerNotes: 'Cần kho mát',
    status: TourAppointmentStatus.PENDING,
    assignedTo: null,
    managerNotes: null,
    staffResultNotes: null,
    cancellationReason: null,
    createdAt: new Date('2026-11-06T10:00:00Z'),
    updatedAt: new Date('2026-11-06T10:00:00Z'),
    facility: { id: 'fac-1', code: 'CN-HCM', name: 'Chi nhánh Quận 1' },
    storageUnit: { id: 'unit-1', code: 'U-101', name: 'Phòng 101', addressLine: 'Kho 101, Tầng 1' },
  },
  {
    id: 'apt-2',
    facilityId: 'fac-1',
    storageUnitId: null,
    customerId: null,
    fullName: 'Trần Thị B',
    phone: '0912345678',
    email: 'ttb@example.com',
    preferredDate: '2026-11-21',
    preferredTimeSlot: '14:00 - 15:00',
    customerNotes: null,
    status: TourAppointmentStatus.CONFIRMED,
    assignedTo: 'staff-1',
    managerNotes: 'Khách hẹn chiều',
    staffResultNotes: null,
    cancellationReason: null,
    createdAt: new Date('2026-11-06T11:00:00Z'),
    updatedAt: new Date('2026-11-06T11:30:00Z'),
    facility: { id: 'fac-1', code: 'CN-HCM', name: 'Chi nhánh Quận 1' },
    assignee: { id: 'staff-1', fullName: 'Lê Nhân Viên', email: 'staff@example.com' },
  },
];

describe('TourAppointmentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'u-1', fullName: 'Manager', roles: [UserRole.FACILITY_MANAGER] } as any,
      activeRole: UserRole.FACILITY_MANAGER,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    vi.spyOn(FacilityContextModule, 'useFacility').mockReturnValue({
      facilities: [{ id: 'fac-1', code: 'CN-HCM', name: 'Chi nhánh Quận 1' }] as any,
      selectedFacility: { id: 'fac-1', code: 'CN-HCM', name: 'Chi nhánh Quận 1' } as any,
      selectFacility: vi.fn(),
      canSelectAll: false,
      isLoading: false,
      refreshFacilities: vi.fn(),
    });

    vi.spyOn(FacilitiesApi, 'listStaff').mockResolvedValue([
      { id: 'staff-1', fullName: 'Lê Nhân Viên', email: 'staff@example.com' } as any,
    ]);

    vi.spyOn(TourAppointmentsApi, 'list').mockResolvedValue({
      appointments: mockAppointments,
      meta: {
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    });
  });

  it('renders list of tour appointments with KPI summary and table rows', async () => {
    render(
      <MemoryRouter>
        <TourAppointmentsPage />
      </MemoryRouter>,
    );

    // Assert page header
    expect(screen.getByText('Lịch hẹn xem kho mẫu')).toBeTruthy();

    // Assert appointment items are rendered
    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn A')).toBeTruthy();
      expect(screen.getByText('Trần Thị B')).toBeTruthy();
    });

    // Assert table content
    expect(screen.getByText('0901234567')).toBeTruthy();
    expect(screen.getByText('Phòng 101 (U-101)')).toBeTruthy();
    expect(screen.getByText('Chờ liên hệ')).toBeTruthy();
    expect(screen.getByText('Đã xác nhận')).toBeTruthy();
  });

  it('opens detail dialog when clicking "Xem"', async () => {
    render(
      <MemoryRouter>
        <TourAppointmentsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn A')).toBeTruthy();
    });

    const viewButtons = screen.getAllByRole('button', { name: /xem/i });
    fireEvent.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Chi tiết lịch xem kho')).toBeTruthy();
      expect(screen.getByText('Thông tin khách hàng')).toBeTruthy();
      expect(screen.getByText('Thời gian & Địa điểm tham quan')).toBeTruthy();
    });
  });

  it('filters appointments when changing date filter', async () => {
    render(
      <MemoryRouter>
        <TourAppointmentsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(TourAppointmentsApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ facilityId: 'fac-1' }),
      );
    });

    const fromDateInput = screen.getByLabelText('Từ ngày');
    fireEvent.change(fromDateInput, { target: { value: '2026-11-20' } });

    await waitFor(() => {
      expect(TourAppointmentsApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ fromDate: '2026-11-20' }),
      );
    });
  });
});
