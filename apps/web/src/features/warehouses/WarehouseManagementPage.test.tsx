import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as FacilityContextModule from '../../context/FacilityContext';
import { LocationsApi, WarehousesApi } from '../../lib/api';
import type { Warehouse } from '../../types/warehouse';
import { WarehouseManagementPage } from './WarehouseManagementPage';

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  notifyCreated: vi.fn(),
  notifyUpdated: vi.fn(),
  notifyDeleted: vi.fn(),
}));

vi.mock('../../lib/toast', () => ({ useAppToast: () => toast }));

const base: Warehouse = {
  id: 'w-1',
  facility: { id: 'fac-1', code: 'CN-HCM', name: 'Cơ sở Hồ Chí Minh' },
  code: 'HCM-SG-01',
  name: 'Kho mini Sài Gòn',
  addressLine: '45 Lê Thánh Tôn',
  wardCode: '26740',
  provinceCode: '79',
  latitude: 10.7769,
  longitude: 106.7032,
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
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

const WAREHOUSES: Warehouse[] = [
  base,
  {
    ...base,
    id: 'w-2',
    code: 'HCM-TT-01',
    name: 'Kho Tân Thuận',
    depositMonths: 2,
    effectiveDepositMonths: 2,
    status: 'RENTED',
  },
];

const FACILITIES = [
  { id: 'fac-1', code: 'CN-HCM', name: 'Cơ sở Hồ Chí Minh', provinceCode: '79', status: 'ACTIVE' },
  { id: 'fac-2', code: 'CN-HN', name: 'Cơ sở Hà Nội', provinceCode: '01', status: 'ACTIVE' },
];

const mockFacility = (selectedFacility: (typeof FACILITIES)[number] | null) =>
  vi.spyOn(FacilityContextModule, 'useFacility').mockReturnValue({
    facilities: FACILITIES,
    selectedFacility,
    selectFacility: vi.fn(),
    refreshFacilities: vi.fn(),
    canSelectAll: true,
    isLoading: false,
  });

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('WarehouseManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFacility(null);
    vi.spyOn(LocationsApi, 'provinces').mockResolvedValue([]);
    vi.spyOn(LocationsApi, 'wards').mockResolvedValue([]);
    vi.spyOn(WarehousesApi, 'listAdmin').mockResolvedValue({
      warehouses: WAREHOUSES,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
  });

  it('renders KPI cards and warehouse rows with deposit and size info', async () => {
    render(<WarehouseManagementPage />);

    await waitFor(() => expect(screen.getByText('Kho Tân Thuận')).toBeTruthy());
    expect(screen.getByText('Tổng số kho')).toBeTruthy();
    expect(screen.getByText('Mặc định (1 tháng)')).toBeTruthy();
    expect(screen.getByText('2 tháng')).toBeTruthy();
    expect(screen.getAllByText('3 × 4 × 2,8 m').length).toBe(2);
    expect(screen.getByText('Còn trống')).toBeTruthy();
    expect(screen.getByText('Đang thuê')).toBeTruthy();
  });

  it('creates a warehouse with depositMonths null when "Mặc định" is kept', async () => {
    mockFacility(FACILITIES[0]);
    const create = vi.spyOn(WarehousesApi, 'create').mockResolvedValue(base);
    render(<WarehouseManagementPage />);
    await waitFor(() => expect(screen.getByText('Kho Tân Thuận')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /thêm kho/i }));
    await waitFor(() => expect(screen.getByLabelText('Mã kho')).toBeTruthy());

    fill('Mã kho', ' HN-01 ');
    fill('Tên kho', 'Kho Hà Nội');
    fill('Địa chỉ kho', '1 Phố Huế');
    fill('Vĩ độ (latitude)', '21.0');
    fill('Kinh độ (longitude)', '105.8');
    fill('Chiều rộng (m)', '3');
    fill('Chiều dài (m)', '5');
    fill('Chiều cao (m)', '2.5');
    fill('Giá thuê / tháng (VND)', '4000000');

    expect(screen.getByTestId('derived-area').textContent).toBe('15 m²');
    expect(screen.getByTestId('derived-volume').textContent).toBe('37,5 m³');

    fireEvent.click(screen.getByRole('button', { name: 'Tạo kho' }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith({
      facilityId: 'fac-1',
      code: 'HN-01',
      name: 'Kho Hà Nội',
      addressLine: '1 Phố Huế',
      latitude: 21,
      longitude: 105.8,
      widthM: 3,
      lengthM: 5,
      heightM: 2.5,
      monthlyPrice: 4000000,
      depositMonths: null,
      status: 'AVAILABLE',
    });
    expect(toast.notifyCreated).toHaveBeenCalledWith('kho', 'HN-01');
  });

  it('shows a readable toast when the API rejects with a duplicate code (409)', async () => {
    mockFacility(FACILITIES[0]);
    const err = Object.assign(new Error('Code already exists'), { status: 409 });
    vi.spyOn(WarehousesApi, 'create').mockRejectedValue(err);
    render(<WarehouseManagementPage />);
    await waitFor(() => expect(screen.getByText('Kho Tân Thuận')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /thêm kho/i }));
    await waitFor(() => expect(screen.getByLabelText('Mã kho')).toBeTruthy());
    fill('Mã kho', 'DUP');
    fill('Tên kho', 'Kho trùng');
    fill('Địa chỉ kho', 'Đâu đó');
    fill('Vĩ độ (latitude)', '10');
    fill('Kinh độ (longitude)', '106');
    fill('Chiều rộng (m)', '2');
    fill('Chiều dài (m)', '2');
    fill('Chiều cao (m)', '2');
    fill('Giá thuê / tháng (VND)', '1000000');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo kho' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Lỗi tạo kho',
        expect.stringContaining('Mã kho đã tồn tại'),
      ),
    );
  });

  it('blocks submit with a warning when required fields are missing', async () => {
    const create = vi.spyOn(WarehousesApi, 'create');
    render(<WarehouseManagementPage />);
    fireEvent.click(screen.getByRole('button', { name: /thêm kho/i }));
    await waitFor(() => expect(screen.getByLabelText('Mã kho')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Tạo kho' }));

    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
    expect(create).not.toHaveBeenCalled();
  });

  it('blocks creating a warehouse until a facility is chosen', async () => {
    const create = vi.spyOn(WarehousesApi, 'create');
    render(<WarehouseManagementPage />);
    await waitFor(() => expect(screen.getByText('Kho Tân Thuận')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /thêm kho/i }));
    await waitFor(() => expect(screen.getByLabelText('Mã kho')).toBeTruthy());
    fill('Mã kho', 'X-1');
    fill('Tên kho', 'Kho X');
    fill('Địa chỉ kho', 'Đâu đó');
    fill('Vĩ độ (latitude)', '10');
    fill('Kinh độ (longitude)', '106');
    fill('Chiều rộng (m)', '2');
    fill('Chiều dài (m)', '2');
    fill('Chiều cao (m)', '2');
    fill('Giá thuê / tháng (VND)', '1000000');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo kho' }));

    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(
        'Thông tin chưa hợp lệ',
        'Vui lòng chọn cơ sở cho kho.',
      ),
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('filters by the facility selected in the header and shows the facility column', async () => {
    mockFacility(FACILITIES[1]);
    const listAdmin = vi.mocked(WarehousesApi.listAdmin);
    render(<WarehouseManagementPage />);
    await waitFor(() =>
      expect(listAdmin).toHaveBeenCalledWith(expect.objectContaining({ facilityId: 'fac-2' })),
    );
    expect(screen.getAllByText('Cơ sở Hồ Chí Minh').length).toBeGreaterThan(0);
  });

  it('locks the facility select while the warehouse is occupied', async () => {
    render(<WarehouseManagementPage />);
    await waitFor(() => expect(screen.getByText('Kho Tân Thuận')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa kho HCM-TT-01' }));
    await waitFor(() => expect(screen.getByLabelText('Mã kho')).toBeTruthy());
    expect((screen.getByLabelText('Mã kho') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText('Chỉ chuyển cơ sở khi kho đang trống.')).toBeTruthy();
    expect(screen.getByText(/không thể đổi cơ sở/)).toBeTruthy();
  });

  it('explains the 409 reason when deleting an occupied warehouse', async () => {
    const err = Object.assign(new Error('conflict'), {
      status: 409,
      details: { status: 'RENTED', openTours: 0 },
    });
    const remove = vi.spyOn(WarehousesApi, 'remove').mockRejectedValue(err);
    render(<WarehouseManagementPage />);
    await waitFor(() => expect(screen.getByText('Kho Tân Thuận')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Xóa kho HCM-TT-01' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận xóa' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('w-2'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Đang thuê');
    expect(toast.error).toHaveBeenCalledWith(
      'Không thể xóa kho',
      expect.stringContaining('Đang thuê'),
    );
  });
});
