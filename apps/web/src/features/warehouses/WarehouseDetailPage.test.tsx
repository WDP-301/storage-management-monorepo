import { LayoutElementType, UserRole } from '@storage/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FacilitiesApi, WarehousesApi } from '../../lib/api';
import type { LayoutView, Warehouse } from '../../types/warehouse';
import { WarehouseDetailPage } from './WarehouseDetailPage';

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

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', roles: [UserRole.ADMIN], fullName: 'Quản trị viên Demo' },
  }),
}));

const sampleWarehouse: Warehouse = {
  id: 'wh-shelf-1',
  facility: { id: 'fac-1', code: 'CN-HCM', name: 'Chi nhánh Hồ Chí Minh' },
  kind: 'SHELF_WAREHOUSE',
  parentId: null,
  parent: null,
  code: 'HCM-KE-01',
  name: 'Kho kệ Quận 1',
  addressLine: '45 Lê Thánh Tôn',
  wardCode: '26740',
  provinceCode: '79',
  latitude: 10.777,
  longitude: 106.701,
  widthM: 10,
  lengthM: 20,
  heightM: 4,
  areaM2: 200,
  volumeM3: 800,
  monthlyPrice: 0,
  depositMonths: null,
  effectiveDepositMonths: 1,
  status: 'AVAILABLE',
  notes: null,
  images: [],
  shelfSummary: {
    total: 2,
    available: 2,
    minMonthlyPrice: 450000,
    statusCounts: { AVAILABLE: 2, HELD: 0, RENTED: 0, MAINTENANCE: 0 },
    minAreaM2: 3,
    maxAreaM2: 3,
    minVolumeM3: 6,
    maxVolumeM3: 6,
  },
  createdAt: '2026-10-13T00:00:00.000Z',
  updatedAt: '2026-10-13T00:00:00.000Z',
};

const shelf1: Warehouse = {
  ...sampleWarehouse,
  id: 'sh-1',
  kind: 'SHELF',
  parentId: sampleWarehouse.id,
  code: 'HCM-KE-01-A-01',
  name: 'Kho kệ Quận 1 · Kệ A-01',
  widthM: 1.5,
  lengthM: 2,
  heightM: 2,
  areaM2: 3,
  volumeM3: 6,
  monthlyPrice: 450000,
  status: 'AVAILABLE',
};

const sampleLayout: LayoutView = {
  warehouseId: sampleWarehouse.id,
  layout: {
    rows: 8,
    cols: 10,
    version: 1,
    updatedAt: '2026-10-13T01:00:00.000Z',
    elements: [{ type: LayoutElementType.DOOR, row: 0, col: 0, rowSpan: 1, colSpan: 1 }],
    updatedBy: 'admin-1',
  },
  placed: [{ shelf: shelf1, row: 1, col: 1, rowSpan: 1, colSpan: 1 }],
  unplaced: [],
};

const renderPage = (warehouseId = 'wh-shelf-1') => {
  return render(
    <MemoryRouter initialEntries={[`/admin/warehouses/${warehouseId}`]}>
      <Routes>
        <Route path="/admin/warehouses/:id" element={<WarehouseDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('WarehouseDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(FacilitiesApi, 'listAll').mockResolvedValue([]);
    vi.spyOn(WarehousesApi, 'get').mockResolvedValue(sampleWarehouse);
    vi.spyOn(WarehousesApi, 'listShelvesAdmin').mockResolvedValue([shelf1]);
    vi.spyOn(WarehousesApi, 'getLayoutAdmin').mockResolvedValue(sampleLayout);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders warehouse details, shelf list and KPI summary', async () => {
    renderPage();

    expect(await screen.findByText('Kho kệ Quận 1 (HCM-KE-01)')).toBeTruthy();
    expect(screen.getByText('Chi nhánh Hồ Chí Minh (CN-HCM) · 45 Lê Thánh Tôn')).toBeTruthy();
    expect(screen.getByText('HCM-KE-01-A-01')).toBeTruthy();
    expect(screen.getByText('450.000 đ')).toBeTruthy();
  });

  it('switches between shelves list and floor plan layout tabs', async () => {
    renderPage();

    expect(await screen.findByText('HCM-KE-01-A-01')).toBeTruthy();

    // Click tab Sơ đồ mặt bằng
    fireEvent.click(screen.getByRole('button', { name: 'Sơ đồ mặt bằng' }));

    expect(await screen.findByText('Sơ đồ 8 hàng × 10 cột')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kéo xem' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Vừa khung hình' })).toBeTruthy();

    // Switch back to Danh sách kệ
    fireEvent.click(screen.getByRole('button', { name: /Danh sách kệ/ }));
    expect(await screen.findByText('HCM-KE-01-A-01')).toBeTruthy();
  });

  it('supports single shelf creation directly from detail page', async () => {
    const createSpy = vi.spyOn(WarehousesApi, 'createShelf').mockResolvedValue({
      ...shelf1,
      id: 'sh-2',
      code: 'HCM-KE-01-A-02',
    });

    renderPage();

    expect(await screen.findByText('HCM-KE-01-A-01')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Thêm kệ lẻ' }));
    fireEvent.change(screen.getByLabelText('Mã kệ'), { target: { value: 'HCM-KE-01-A-02' } });
    fireEvent.change(screen.getByLabelText('Chiều rộng kệ (m)'), { target: { value: '1.5' } });
    fireEvent.change(screen.getByLabelText('Chiều dài kệ (m)'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Giá thuê kệ / tháng (VND)'), {
      target: { value: '500000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo kệ' }));

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith(
        sampleWarehouse.id,
        expect.objectContaining({
          code: 'HCM-KE-01-A-02',
          widthM: 1.5,
          lengthM: 2,
          monthlyPrice: 500000,
        }),
      ),
    );
  });
});
