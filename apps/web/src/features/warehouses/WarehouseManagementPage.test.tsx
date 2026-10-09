import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as FacilityContextModule from '../../context/FacilityContext';
import { LocationsApi, PlacesApi, WarehousesApi } from '../../lib/api';
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

// MapLibre needs WebGL; the stub exposes what the page passes to the map.
vi.mock('./WarehouseOverviewMap', () => ({
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

const fillValidWarehouse = (code: string) => {
  fill('Mã kho', code);
  fill('Tên kho', 'Kho Quận 7');
  fill('Địa chỉ kho', '1 Nguyễn Thị Thập');
  fill('Vĩ độ (latitude)', '10.73');
  fill('Kinh độ (longitude)', '106.72');
  fill('Chiều rộng (m)', '3');
  fill('Chiều dài (m)', '5');
  fill('Chiều cao (m)', '3');
  fill('Giá thuê / tháng (VND)', '4000000');
};

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

  it('plots every warehouse matching the filters, not only the table page', async () => {
    mockFacility(FACILITIES[0]);
    const offPage = { ...WAREHOUSES[0], id: 'w-3', code: 'HCM-TD-01', name: 'Kho Thủ Đức' };
    const listAdminAll = vi
      .spyOn(WarehousesApi, 'listAdminAll')
      .mockResolvedValue([...WAREHOUSES, offPage]);
    render(<WarehouseManagementPage />);
    await waitFor(() => expect(screen.getByText('Kho Tân Thuận')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Xem kho HCM-SG-01 trên bản đồ' }));
    const map = await screen.findByRole('region', { name: 'Bản đồ kho (stub)' });
    await waitFor(() => expect(map.textContent).toContain('ghim HCM-TD-01'));
    expect(listAdminAll).toHaveBeenCalledWith(expect.objectContaining({ facilityId: 'fac-1' }));
    expect(listAdminAll.mock.calls[0][0]).not.toHaveProperty('page');

    // The focused warehouse survives the map's first load and offers the edit action.
    fireEvent.click(within(map).getByRole('button', { name: 'Sửa kho' }));
    await waitFor(() => expect(screen.getByLabelText('Mã kho')).toBeTruthy());
    expect((screen.getByLabelText('Mã kho') as HTMLInputElement).value).toBe('HCM-SG-01');
  });

  it('keeps the map focus when a refetch pushes the warehouse off the table page', async () => {
    vi.spyOn(WarehousesApi, 'listAdminAll').mockResolvedValue(WAREHOUSES);
    const listAdmin = vi.mocked(WarehousesApi.listAdmin);
    render(<WarehouseManagementPage />);
    await waitFor(() => expect(screen.getByText('Kho Tân Thuận')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Xem kho HCM-SG-01 trên bản đồ' }));
    const map = await screen.findByRole('region', { name: 'Bản đồ kho (stub)' });
    await waitFor(() => expect(within(map).getByRole('button', { name: 'Sửa kho' })).toBeTruthy());

    listAdmin.mockResolvedValue({
      warehouses: [WAREHOUSES[1]],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
    await waitFor(() => expect(listAdmin).toHaveBeenLastCalledWith(expect.anything()));
    await waitFor(() => expect(within(map).getByRole('button', { name: 'Sửa kho' })).toBeTruthy());
  });

  it('does not refetch the hidden map while filtering the list', async () => {
    const listAdminAll = vi.spyOn(WarehousesApi, 'listAdminAll').mockResolvedValue(WAREHOUSES);
    render(<WarehouseManagementPage />);
    await waitFor(() => expect(screen.getByText('Kho Tân Thuận')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Bản đồ' }));
    await waitFor(() => expect(listAdminAll).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Danh sách' }));
    fill('Diện tích từ (m²)', '20');
    await waitFor(() =>
      expect(vi.mocked(WarehousesApi.listAdmin)).toHaveBeenCalledWith(
        expect.objectContaining({ minArea: 20 }),
      ),
    );
    expect(listAdminAll).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Bản đồ' }));
    await waitFor(() => expect(listAdminAll).toHaveBeenCalledTimes(2));
    expect(listAdminAll).toHaveBeenLastCalledWith(expect.objectContaining({ minArea: 20 }));
  });

  it('keeps a table focus requested while the hidden map data is out of date', async () => {
    const listAdminAll = vi
      .spyOn(WarehousesApi, 'listAdminAll')
      .mockResolvedValueOnce([WAREHOUSES[1]])
      .mockResolvedValue(WAREHOUSES);
    render(<WarehouseManagementPage />);
    await waitFor(() => expect(screen.getByText('Kho Tân Thuận')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Bản đồ' }));
    await waitFor(() => expect(listAdminAll).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Danh sách' }));
    fill('Giá từ (đ/tháng)', '1000');
    await waitFor(() =>
      expect(vi.mocked(WarehousesApi.listAdmin)).toHaveBeenCalledWith(
        expect.objectContaining({ minPrice: 1000 }),
      ),
    );

    // HCM-SG-01 is missing from the map data fetched for the old filters.
    fireEvent.click(screen.getByRole('button', { name: 'Xem kho HCM-SG-01 trên bản đồ' }));
    const map = screen.getByRole('region', { name: 'Bản đồ kho (stub)' });
    await waitFor(() => expect(listAdminAll).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(within(map).getByRole('button', { name: 'Sửa kho' })).toBeTruthy());
  });

  it('geocodes the typed address with the warehouse ward and province', async () => {
    vi.spyOn(LocationsApi, 'provinces').mockResolvedValue([
      { code: '79', name: 'Thành phố Hồ Chí Minh' },
    ]);
    vi.spyOn(LocationsApi, 'wards').mockResolvedValue([
      { code: '26740', name: 'Phường Sài Gòn', provinceCode: '79' },
    ]);
    const autocomplete = vi
      .spyOn(PlacesApi, 'autocomplete')
      .mockResolvedValue([{ place_id: 'p-1', description: '45 Lê Thánh Tôn, Sài Gòn' }]);
    vi.spyOn(PlacesApi, 'detail').mockResolvedValue({
      placeId: 'p-1',
      address: '45 Lê Thánh Tôn, Sài Gòn',
      lat: 10.777,
      lng: 106.701,
    });
    render(<WarehouseManagementPage />);
    await waitFor(() => expect(screen.getByText('Kho Tân Thuận')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa kho HCM-SG-01' }));
    await waitFor(() => expect(LocationsApi.wards).toHaveBeenCalledWith('79'));
    fireEvent.click(await screen.findByRole('button', { name: 'Lấy tọa độ từ địa chỉ' }));

    await waitFor(() =>
      expect((screen.getByLabelText('Vĩ độ (latitude)') as HTMLInputElement).value).toBe('10.777'),
    );
    expect((screen.getByLabelText('Kinh độ (longitude)') as HTMLInputElement).value).toBe(
      '106.701',
    );
    expect(autocomplete).toHaveBeenCalledWith(
      '45 Lê Thánh Tôn, Phường Sài Gòn, Thành phố Hồ Chí Minh',
    );
    expect((screen.getByLabelText('Địa chỉ kho') as HTMLInputElement).value).toBe(
      '45 Lê Thánh Tôn',
    );
  });

  it('opens a newly created warehouse on the overview map', async () => {
    mockFacility(FACILITIES[0]);
    const created: Warehouse = { ...base, id: 'w-new', code: 'HCM-Q7-01', name: 'Kho Quận 7' };
    vi.spyOn(WarehousesApi, 'create').mockResolvedValue(created);
    vi.spyOn(WarehousesApi, 'listAdminAll').mockResolvedValue([...WAREHOUSES, created]);
    render(<WarehouseManagementPage />);
    await waitFor(() => expect(screen.getByText('Kho Tân Thuận')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /thêm kho/i }));
    await waitFor(() => expect(screen.getByLabelText('Mã kho')).toBeTruthy());
    fillValidWarehouse('HCM-Q7-01');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo kho' }));

    const map = await screen.findByRole('region', { name: 'Bản đồ kho (stub)' });
    await waitFor(() => expect(map.textContent).toContain('ghim HCM-Q7-01'));
    fireEvent.click(within(map).getByRole('button', { name: 'Sửa kho' }));
    await waitFor(() =>
      expect((screen.getByLabelText('Mã kho') as HTMLInputElement).value).toBe('HCM-Q7-01'),
    );
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('gives the filter hint only for the first map load after creating', async () => {
    mockFacility(FACILITIES[0]);
    const created: Warehouse = { ...base, id: 'w-new', code: 'HCM-Q7-01' };
    vi.spyOn(WarehousesApi, 'create').mockResolvedValue(created);
    const listAdminAll = vi
      .spyOn(WarehousesApi, 'listAdminAll')
      .mockResolvedValue([...WAREHOUSES, created]);
    render(<WarehouseManagementPage />);
    await waitFor(() => expect(screen.getByText('Kho Tân Thuận')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /thêm kho/i }));
    await waitFor(() => expect(screen.getByLabelText('Mã kho')).toBeTruthy());
    fillValidWarehouse('HCM-Q7-01');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo kho' }));
    const map = await screen.findByRole('region', { name: 'Bản đồ kho (stub)' });
    await waitFor(() => expect(within(map).getByRole('button', { name: 'Sửa kho' })).toBeTruthy());

    // Someone else deletes it later; that is not the "new warehouse filtered out" case.
    listAdminAll.mockResolvedValue(WAREHOUSES);
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
    await waitFor(() => expect(map.textContent).not.toContain('ghim HCM-Q7-01'));
    await waitFor(() => expect(within(map).queryByRole('button', { name: 'Sửa kho' })).toBeNull());
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('explains when a newly created warehouse falls outside the current filters', async () => {
    mockFacility(FACILITIES[0]);
    const created: Warehouse = { ...base, id: 'w-new', code: 'HCM-Q7-01' };
    vi.spyOn(WarehousesApi, 'create').mockResolvedValue(created);
    vi.spyOn(WarehousesApi, 'listAdminAll').mockResolvedValue(WAREHOUSES);
    render(<WarehouseManagementPage />);
    await waitFor(() => expect(screen.getByText('Kho Tân Thuận')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /thêm kho/i }));
    await waitFor(() => expect(screen.getByLabelText('Mã kho')).toBeTruthy());
    fillValidWarehouse('HCM-Q7-01');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo kho' }));

    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith(
        'Kho mới không hiện trên bản đồ',
        'Kho vừa thêm không khớp bộ lọc hiện tại. Hãy xóa bộ lọc để xem vị trí kho.',
      ),
    );
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('does not jump to the map after editing a warehouse', async () => {
    vi.spyOn(WarehousesApi, 'update').mockResolvedValue({ ...base, name: 'Kho đổi tên' });
    render(<WarehouseManagementPage />);
    await waitFor(() => expect(screen.getByText('Kho Tân Thuận')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa kho HCM-SG-01' }));
    await waitFor(() => expect(screen.getByLabelText('Tên kho')).toBeTruthy());
    fill('Tên kho', 'Kho đổi tên');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(toast.notifyUpdated).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: 'Bản đồ kho (stub)' })).toBeNull();
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
