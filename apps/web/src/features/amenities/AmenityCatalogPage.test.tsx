import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AmenitiesApi } from '../../lib/amenities-api';
import type { Amenity } from '../../types/amenity';
import { AmenityCatalogPage } from './AmenityCatalogPage';

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

const CCTV: Amenity = {
  id: 'a1',
  code: 'CCTV',
  name: 'Camera an ninh',
  description: 'Ghi hình 24/7',
  isActive: true,
  sortOrder: 1,
};
const RACK: Amenity = {
  id: 'a2',
  code: 'RACK',
  name: 'Giá kệ',
  description: null,
  isActive: false,
  sortOrder: 2,
};

describe('AmenityCatalogPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.spyOn(AmenitiesApi, 'listAdmin').mockResolvedValue([CCTV, RACK]);
  });

  it('lists every amenity with its status and the no-extra-fee note', async () => {
    render(<AmenityCatalogPage />);
    expect(await screen.findByText('Camera an ninh')).toBeTruthy();
    expect(screen.getByText('Giá kệ')).toBeTruthy();
    expect(screen.getByText('Đang dùng')).toBeTruthy();
    expect(screen.getAllByText('Ngừng dùng').length).toBeGreaterThan(0);
    expect(screen.getByText(/không thu phí riêng/)).toBeTruthy();
  });

  it('retires an amenity only after confirmation', async () => {
    const update = vi.spyOn(AmenitiesApi, 'update').mockResolvedValue({ ...CCTV, isActive: false });
    render(<AmenityCatalogPage />);
    await screen.findByText('Camera an ninh');

    fireEvent.click(screen.getByRole('button', { name: 'Ngừng dùng tiện ích CCTV' }));
    expect(update).not.toHaveBeenCalled();
    expect(await screen.findByText(/các kho đang gắn vẫn giữ/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận ngừng dùng' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith('a1', { isActive: false }));
  });

  it('reactivates a retired amenity directly', async () => {
    const update = vi.spyOn(AmenitiesApi, 'update').mockResolvedValue({ ...RACK, isActive: true });
    render(<AmenityCatalogPage />);
    await screen.findByText('Giá kệ');

    fireEvent.click(screen.getByRole('button', { name: 'Dùng lại tiện ích RACK' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('a2', { isActive: true }));
  });

  it('creates an amenity with an upper-cased code', async () => {
    const create = vi.spyOn(AmenitiesApi, 'create').mockResolvedValue(CCTV);
    render(<AmenityCatalogPage />);
    await screen.findByText('Camera an ninh');

    fireEvent.click(screen.getByRole('button', { name: 'Thêm tiện ích' }));
    fireEvent.change(await screen.findByLabelText('Mã tiện ích'), { target: { value: 'wifi' } });
    fireEvent.change(screen.getByLabelText('Tên tiện ích'), { target: { value: 'Wi-Fi' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Thêm tiện ích' }).at(-1) as HTMLElement);

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ code: 'WIFI', name: 'Wi-Fi', sortOrder: 0 }),
    );
    await waitFor(() => expect(toast.notifyCreated).toHaveBeenCalledWith('tiện ích', 'CCTV'));
  });

  it('shows a readable message when the code already exists', async () => {
    vi.spyOn(AmenitiesApi, 'create').mockRejectedValue(
      Object.assign(new Error('Amenity code already exists'), { status: 409 }),
    );
    render(<AmenityCatalogPage />);
    await screen.findByText('Camera an ninh');

    fireEvent.click(screen.getByRole('button', { name: 'Thêm tiện ích' }));
    fireEvent.change(await screen.findByLabelText('Mã tiện ích'), { target: { value: 'CCTV' } });
    fireEvent.change(screen.getByLabelText('Tên tiện ích'), { target: { value: 'Trùng' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Thêm tiện ích' }).at(-1) as HTMLElement);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Lỗi tạo tiện ích', 'Mã tiện ích đã tồn tại.'),
    );
  });
});
