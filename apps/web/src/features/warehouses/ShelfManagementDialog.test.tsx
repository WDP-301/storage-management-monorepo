import { LayoutElementType } from '@storage/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WarehousesApi } from '../../lib/api';
import type { LayoutView, Warehouse } from '../../types/warehouse';
import { ShelfManagementDialog } from './ShelfManagementDialog';

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

const parentWarehouse: Warehouse = {
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

const shelfA1: Warehouse = {
  ...parentWarehouse,
  id: 'sh-1',
  kind: 'SHELF',
  parentId: parentWarehouse.id,
  parent: { id: parentWarehouse.id, code: parentWarehouse.code, name: parentWarehouse.name },
  code: 'HCM-KE-01-A-01',
  name: 'Kho kệ Quận 1 · Kệ A-01',
  widthM: 1.5,
  lengthM: 2,
  heightM: 2,
  areaM2: 3,
  volumeM3: 6,
  monthlyPrice: 450000,
  depositMonths: null,
  effectiveDepositMonths: 1,
  status: 'AVAILABLE',
  shelfSummary: null,
};

const shelfA2: Warehouse = {
  ...shelfA1,
  id: 'sh-2',
  code: 'HCM-KE-01-A-02',
  name: 'Kho kệ Quận 1 · Kệ A-02',
};

const baseLayout = {
  rows: 2,
  cols: 3,
  version: 1,
  updatedAt: '2026-10-13T01:00:00.000Z',
  elements: [
    {
      type: LayoutElementType.LABEL,
      row: 0,
      col: 0,
      rowSpan: 1,
      colSpan: 1,
      text: 'Dãy A',
    },
  ],
  updatedBy: 'u-1',
};

const sampleLayoutView: LayoutView = {
  warehouseId: parentWarehouse.id,
  layout: baseLayout,
  placed: [
    {
      shelf: shelfA1,
      row: 0,
      col: 1,
      rowSpan: 1,
      colSpan: 1,
    },
  ],
  unplaced: [shelfA2],
};

describe('ShelfManagementDialog & ShelfLayoutEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(WarehousesApi, 'listShelvesAdmin').mockResolvedValue([shelfA1, shelfA2]);
    vi.spyOn(WarehousesApi, 'getLayoutAdmin').mockResolvedValue(sampleLayoutView);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists shelves and supports creating single and bulk shelves for ADMIN/OPERATIONS_MANAGER', async () => {
    const createShelfSpy = vi.spyOn(WarehousesApi, 'createShelf').mockResolvedValue(shelfA1);
    const bulkCreateSpy = vi.spyOn(WarehousesApi, 'bulkCreateShelves').mockResolvedValue({
      created: 5,
      codes: ['HCM-KE-01-B-01', 'HCM-KE-01-B-05'],
    });
    const onChanged = vi.fn();

    render(
      <ShelfManagementDialog
        warehouse={parentWarehouse}
        canManageShelves={true}
        onClose={vi.fn()}
        onChanged={onChanged}
      />,
    );

    expect(await screen.findByText('HCM-KE-01-A-01')).toBeTruthy();
    expect(screen.getByText('HCM-KE-01-A-02')).toBeTruthy();

    // Open single shelf form
    fireEvent.click(screen.getByRole('button', { name: 'Thêm kệ lẻ' }));
    fireEvent.change(screen.getByLabelText('Mã kệ'), { target: { value: 'HCM-KE-01-A-03' } });
    fireEvent.change(screen.getByLabelText('Chiều rộng kệ (m)'), { target: { value: '1.5' } });
    fireEvent.change(screen.getByLabelText('Chiều dài kệ (m)'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Giá thuê kệ / tháng (VND)'), {
      target: { value: '500000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo kệ' }));

    await waitFor(() =>
      expect(createShelfSpy).toHaveBeenCalledWith(parentWarehouse.id, {
        code: 'HCM-KE-01-A-03',
        widthM: 1.5,
        lengthM: 2,
        monthlyPrice: 500000,
        depositMonths: null,
        status: 'AVAILABLE',
      }),
    );
    expect(onChanged).toHaveBeenCalled();

    // Open bulk shelf form
    fireEvent.click(screen.getByRole('button', { name: 'Tạo dãy kệ hàng loạt' }));
    fireEvent.change(screen.getByLabelText('Tiền tố dãy (VD: A, B1)'), {
      target: { value: 'B' },
    });
    fireEvent.change(screen.getByLabelText('Từ số thứ tự'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Đến số thứ tự'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Chiều rộng mỗi kệ (m)'), {
      target: { value: '1.2' },
    });
    fireEvent.change(screen.getByLabelText('Chiều dài mỗi kệ (m)'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Giá thuê mỗi kệ / tháng (VND)'), {
      target: { value: '400000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo hàng loạt' }));

    await waitFor(() =>
      expect(bulkCreateSpy).toHaveBeenCalledWith(parentWarehouse.id, {
        prefix: 'B',
        from: 1,
        to: 5,
        pad: 2,
        widthM: 1.2,
        lengthM: 2,
        monthlyPrice: 400000,
        depositMonths: null,
      }),
    );
  });

  it('suggests codes after the highest existing shelf of the chosen prefix', async () => {
    render(
      <ShelfManagementDialog
        warehouse={parentWarehouse}
        canManageShelves={true}
        onClose={vi.fn()}
      />,
    );
    expect(await screen.findByText('HCM-KE-01-A-02')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Thêm kệ lẻ' }));
    expect((screen.getByLabelText('Mã kệ') as HTMLInputElement).value).toBe('HCM-KE-01-A-03');

    fireEvent.click(screen.getByRole('button', { name: 'Tạo dãy kệ hàng loạt' }));
    const from = () => (screen.getByLabelText('Từ số thứ tự') as HTMLInputElement).value;
    const to = () => (screen.getByLabelText('Đến số thứ tự') as HTMLInputElement).value;
    expect([from(), to()]).toEqual(['3', '12']);

    fireEvent.change(screen.getByLabelText('Tiền tố dãy (VD: A, B1)'), {
      target: { value: 'B' },
    });
    expect([from(), to()]).toEqual(['1', '10']);
  });

  it('names the taken shelf codes when bulk create hits a 409', async () => {
    const conflict = Object.assign(new Error('Shelf code already exists: HCM-KE-01-A-01'), {
      status: 409,
      details: { codes: ['HCM-KE-01-A-01'] },
    });
    vi.spyOn(WarehousesApi, 'bulkCreateShelves').mockRejectedValue(conflict);
    render(
      <ShelfManagementDialog
        warehouse={parentWarehouse}
        canManageShelves={true}
        onClose={vi.fn()}
      />,
    );
    expect(await screen.findByText('HCM-KE-01-A-01')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Tạo dãy kệ hàng loạt' }));
    fireEvent.change(screen.getByLabelText('Từ số thứ tự'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Chiều rộng mỗi kệ (m)'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Chiều dài mỗi kệ (m)'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Giá thuê mỗi kệ / tháng (VND)'), {
      target: { value: '100000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo hàng loạt' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Không tạo được dãy kệ',
        'Mã kệ đã tồn tại: HCM-KE-01-A-01. Vui lòng chọn mã hoặc khoảng số thứ tự khác.',
      ),
    );
  });

  it('hides create/edit/delete shelf actions when canManageShelves is false (Facility Manager)', async () => {
    const updateStatusSpy = vi
      .spyOn(WarehousesApi, 'updateStatus')
      .mockResolvedValue({ ...shelfA1, status: 'MAINTENANCE' });

    render(
      <ShelfManagementDialog
        warehouse={parentWarehouse}
        canManageShelves={false}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText('HCM-KE-01-A-01')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thêm kệ lẻ' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tạo dãy kệ hàng loạt' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sửa kệ HCM-KE-01-A-01' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xóa kệ HCM-KE-01-A-01' })).toBeNull();

    // Facility manager can still toggle shelf maintenance
    fireEvent.click(screen.getAllByRole('button', { name: 'Báo bảo trì' })[0]);
    await waitFor(() => expect(updateStatusSpy).toHaveBeenCalledWith('sh-1', 'MAINTENANCE'));
  });

  it('loads, auto-drafts, saves, and deletes the floor plan layout', async () => {
    const draftSpy = vi.spyOn(WarehousesApi, 'draftLayout').mockResolvedValue({
      rows: 1,
      cols: 3,
      basedOnVersion: 1,
      elements: [
        { type: LayoutElementType.LABEL, row: 0, col: 0, rowSpan: 1, colSpan: 1, text: 'Dãy A' },
      ],
      placements: [
        { shelfId: shelfA1.id, row: 0, col: 1, rowSpan: 1, colSpan: 1 },
        { shelfId: shelfA2.id, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      ],
    });
    const saveSpy = vi.spyOn(WarehousesApi, 'saveLayout').mockResolvedValue({
      ...sampleLayoutView,
      layout: { ...baseLayout, version: 2 },
    });
    const deleteSpy = vi.spyOn(WarehousesApi, 'deleteLayout').mockResolvedValue();

    render(
      <ShelfManagementDialog
        warehouse={parentWarehouse}
        canManageShelves={true}
        initialTab="layout"
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText('Phiên bản v1')).toBeTruthy();

    // Auto-draft
    fireEvent.click(screen.getByRole('button', { name: 'Tạo sơ đồ tự động' }));
    await waitFor(() => expect(draftSpy).toHaveBeenCalledWith(parentWarehouse.id));

    // Save layout
    fireEvent.click(screen.getByRole('button', { name: 'Lưu sơ đồ' }));
    await waitFor(() =>
      expect(saveSpy).toHaveBeenCalledWith(
        parentWarehouse.id,
        expect.objectContaining({
          rows: 1,
          cols: 3,
          version: 1,
        }),
      ),
    );

    // Delete layout
    fireEvent.click(screen.getByRole('button', { name: 'Xóa sơ đồ' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận xóa sơ đồ' }));
    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith(parentWarehouse.id, 2));
  });
});
