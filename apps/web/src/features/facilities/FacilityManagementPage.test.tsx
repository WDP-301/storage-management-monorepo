import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FacilitiesApi, type FacilityRecord, LocationsApi } from '../../lib/api';
import { FacilityManagementPage } from './FacilityManagementPage';

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

const refreshFacilities = vi.hoisted(() => vi.fn());
vi.mock('../../context/FacilityContext', () => ({
  useFacility: () => ({ refreshFacilities }),
}));

const HCM: FacilityRecord = {
  id: 'f1',
  code: 'CN-HCM',
  name: 'Cơ sở Hồ Chí Minh',
  provinceCode: '79',
  status: 'ACTIVE',
  warehouseCount: 4,
};
const HN: FacilityRecord = {
  id: 'f2',
  code: 'CN-HN',
  name: 'Cơ sở Hà Nội',
  provinceCode: null,
  status: 'INACTIVE',
  warehouseCount: 0,
};

const page = (facilities: FacilityRecord[]) => ({
  facilities,
  meta: { page: 1, limit: 20, total: facilities.length, totalPages: 1 },
});

describe('FacilityManagementPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.spyOn(LocationsApi, 'provinces').mockResolvedValue([
      { code: '79', name: 'TP. Hồ Chí Minh' },
    ]);
    vi.spyOn(FacilitiesApi, 'listAdmin').mockResolvedValue(page([HCM, HN]));
  });

  it('lists facilities with their warehouse count and region', async () => {
    render(<FacilityManagementPage />);
    expect(await screen.findByText('Cơ sở Hồ Chí Minh')).toBeTruthy();
    expect(screen.getByText('4 kho')).toBeTruthy();
    expect(screen.getByText('TP. Hồ Chí Minh')).toBeTruthy();
    expect(screen.getByText('Ngừng hoạt động')).toBeTruthy();
  });

  it('creates a facility from the dialog', async () => {
    const create = vi.spyOn(FacilitiesApi, 'create').mockResolvedValue(HCM);
    render(<FacilityManagementPage />);
    await screen.findByText('Cơ sở Hồ Chí Minh');

    fireEvent.click(screen.getByRole('button', { name: /thêm cơ sở/i }));
    fireEvent.change(await screen.findByLabelText('Mã cơ sở'), { target: { value: ' CN-DN ' } });
    fireEvent.change(screen.getByLabelText('Tên cơ sở'), { target: { value: 'Cơ sở Đà Nẵng' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo cơ sở' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ code: 'CN-DN', name: 'Cơ sở Đà Nẵng' }),
    );
    // The header picker and warehouse forms must see the new facility without a reload.
    await waitFor(() => expect(refreshFacilities).toHaveBeenCalled());
    expect(toast.notifyCreated).toHaveBeenCalledWith('cơ sở', 'CN-DN');
  });

  it('shows a Vietnamese message on a duplicate code', async () => {
    vi.spyOn(FacilitiesApi, 'create').mockRejectedValue(
      Object.assign(new Error('Facility code already exists'), { status: 409 }),
    );
    render(<FacilityManagementPage />);
    await screen.findByText('Cơ sở Hồ Chí Minh');

    fireEvent.click(screen.getByRole('button', { name: /thêm cơ sở/i }));
    fireEvent.change(await screen.findByLabelText('Mã cơ sở'), { target: { value: 'CN-HCM' } });
    fireEvent.change(screen.getByLabelText('Tên cơ sở'), { target: { value: 'Trùng' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo cơ sở' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Lỗi tạo cơ sở',
        expect.stringContaining('Mã cơ sở đã tồn tại'),
      ),
    );
  });

  it('deactivates an active facility after confirmation', async () => {
    const update = vi
      .spyOn(FacilitiesApi, 'update')
      .mockResolvedValue({ ...HCM, status: 'INACTIVE' });
    render(<FacilityManagementPage />);
    await screen.findByText('Cơ sở Hồ Chí Minh');

    fireEvent.click(screen.getByRole('button', { name: 'Ngừng hoạt động cơ sở CN-HCM' }));
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Ngừng hoạt động' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith('f1', { status: 'INACTIVE' }));
  });

  it('reactivates an inactive facility directly', async () => {
    const update = vi.spyOn(FacilitiesApi, 'update').mockResolvedValue({ ...HN, status: 'ACTIVE' });
    render(<FacilityManagementPage />);
    await screen.findByText('Cơ sở Hà Nội');

    fireEvent.click(screen.getByRole('button', { name: 'Kích hoạt cơ sở CN-HN' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('f2', { status: 'ACTIVE' }));
  });
});

describe('FacilitiesApi.listAll', () => {
  it('pages through every facility instead of stopping at 100', async () => {
    const listAdmin = vi
      .spyOn(FacilitiesApi, 'listAdmin')
      .mockResolvedValueOnce({
        facilities: [HCM],
        meta: { page: 1, limit: 100, total: 101, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        facilities: [HN],
        meta: { page: 2, limit: 100, total: 101, totalPages: 2 },
      });

    const all = await FacilitiesApi.listAll();

    expect(all).toEqual([HCM, HN]);
    expect(listAdmin).toHaveBeenNthCalledWith(2, { page: 2, limit: 100 });
  });
});
