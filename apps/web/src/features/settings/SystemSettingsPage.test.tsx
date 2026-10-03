import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsApi } from '../../lib/api';
import { SystemSettingsPage } from './SystemSettingsPage';

describe('SystemSettingsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(SettingsApi, 'getAll').mockResolvedValue([]);
    vi.spyOn(SettingsApi, 'update').mockResolvedValue([]);
  });

  const renderComponent = async () => {
    let result: ReturnType<typeof render> | undefined;
    await act(async () => {
      result = render(<SystemSettingsPage />);
    });
    if (!result) {
      throw new Error('Render failed');
    }
    return result;
  };

  it('renders system settings page header, search and category dropdown', async () => {
    await renderComponent();

    expect(screen.getByText('Cấu hình tham số hệ thống')).toBeTruthy();
    expect(screen.getByLabelText('Lọc theo danh mục')).toBeTruthy();
    expect(screen.getByPlaceholderText('Tìm kiếm tham số...')).toBeTruthy();
    expect(screen.getByRole('button', { name: /làm mới/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /lưu thay đổi/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /mặc định/i })).toBeTruthy();
    expect(screen.getByText(/Tổng số tham số:/i)).toBeTruthy();
  });

  it('filters configuration items and updates footer count by category dropdown', async () => {
    await renderComponent();

    // Initially all configs are shown (10 items)
    expect(screen.getByText('Tổng số tham số: 10 mục')).toBeTruthy();
    expect(screen.getByText('Thời gian giữ chỗ tạm thời (Hold timeout)')).toBeTruthy();
    expect(screen.getByText('Tỷ lệ tiền đặt cọc tối thiểu (Tháng thuê)')).toBeTruthy();

    const trigger = screen.getByRole('combobox', { name: /lọc theo danh mục/i });
    fireEvent.click(trigger);

    const depositOption = await screen.findByRole('option', { name: /tiền cọc/i });
    fireEvent.pointerDown(depositOption);
    fireEvent.pointerUp(depositOption);
    fireEvent.click(depositOption);

    // Deposit item should be present, booking item should be filtered out
    expect(screen.getByText('Tỷ lệ tiền đặt cọc tối thiểu (Tháng thuê)')).toBeTruthy();
    expect(screen.queryByText('Thời gian giữ chỗ tạm thời (Hold timeout)')).toBeNull();
    expect(screen.getByText('Tổng số tham số: 1 mục')).toBeTruthy();

    // Select 'idempotency'
    fireEvent.click(trigger);
    const idempotencyOption = await screen.findByRole('option', { name: /idempotency/i });
    fireEvent.pointerDown(idempotencyOption);
    fireEvent.pointerUp(idempotencyOption);
    fireEvent.click(idempotencyOption);
    await waitFor(() => {
      expect(screen.getByText('Tổng số tham số: 2 mục')).toBeTruthy();
    });

    // Select 'booking'
    fireEvent.click(trigger);
    const bookingOption = await screen.findByRole('option', { name: /đặt kho/i });
    fireEvent.pointerDown(bookingOption);
    fireEvent.pointerUp(bookingOption);
    fireEvent.click(bookingOption);
    await waitFor(() => {
      expect(screen.getByText('Tổng số tham số: 7 mục')).toBeTruthy();
    });
  });

  it('filters configuration items by search query', async () => {
    await renderComponent();

    const searchInput = screen.getByPlaceholderText('Tìm kiếm tham số...');
    fireEvent.change(searchInput, { target: { value: 'Hold timeout' } });

    expect(screen.getByText('Thời gian giữ chỗ tạm thời (Hold timeout)')).toBeTruthy();
    expect(screen.queryByText('Tỷ lệ tiền đặt cọc tối thiểu (Tháng thuê)')).toBeNull();
    expect(screen.getByText('Tổng số tham số: 1 mục')).toBeTruthy();
  });

  it('displays empty state when search finds no results', async () => {
    await renderComponent();

    const searchInput = screen.getByPlaceholderText('Tìm kiếm tham số...');
    fireEvent.change(searchInput, { target: { value: 'non_existent_key_xyz' } });

    expect(screen.getByText('Không tìm thấy tham số cấu hình phù hợp với từ khóa.')).toBeTruthy();
    expect(screen.getByText('Tổng số tham số: 0 mục')).toBeTruthy();
  });

  it('resets values back to default when clicking Mặc định', async () => {
    await renderComponent();

    // Find the hold_minutes input (default 15)
    const holdInput = screen.getByDisplayValue('15');
    fireEvent.change(holdInput, { target: { value: '45' } });
    expect(screen.getByDisplayValue('45')).toBeTruthy();

    // Click Reset
    const resetBtn = screen.getByRole('button', { name: /mặc định/i });
    fireEvent.click(resetBtn);

    expect(screen.getByText('Đã khôi phục toàn bộ tham số về giá trị mặc định.')).toBeTruthy();
    expect(screen.getByDisplayValue('15')).toBeTruthy();
  });

  it('triggers save action via SettingsApi and displays feedback message', async () => {
    const updateSpy = vi.spyOn(SettingsApi, 'update').mockResolvedValue([
      {
        key: 'booking.hold_minutes',
        value: 25,
        value_type: 'int',
        group: 'booking',
        label: 'Thời gian giữ chỗ tạm thời (Hold timeout)',
        description: 'Thời gian tối đa tạm giữ kho.',
        default: 15,
        min: 1,
        max: 1440,
        unit: 'phút',
        updated_by: 'admin-1',
        updated_at: new Date().toISOString(),
      },
    ]);

    await renderComponent();

    // Modify hold_minutes
    const holdInput = screen.getByDisplayValue('15');
    fireEvent.change(holdInput, { target: { value: '25' } });

    const saveBtn = screen.getByRole('button', { name: /lưu thay đổi/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ 'booking.hold_minutes': 25 }),
      );
    });

    expect(
      await screen.findByText('Đã lưu cấu hình tham số hệ thống thành công.', undefined, {
        timeout: 2500,
      }),
    ).toBeTruthy();
  });

  it('displays error message when saving fails', async () => {
    vi.spyOn(SettingsApi, 'update').mockRejectedValue(new Error('Lỗi máy chủ khi cập nhật'));

    await renderComponent();

    const saveBtn = screen.getByRole('button', { name: /lưu thay đổi/i });
    fireEvent.click(saveBtn);

    expect(
      await screen.findByText('Lỗi máy chủ khi cập nhật', undefined, {
        timeout: 2500,
      }),
    ).toBeTruthy();
  });

  it('loads real settings from SettingsApi.getAll on mount', async () => {
    vi.spyOn(SettingsApi, 'getAll').mockResolvedValue([
      {
        key: 'booking.hold_minutes',
        value: 20,
        value_type: 'int',
        group: 'booking',
        label: 'Thời gian giữ chỗ tạm thời (Hold timeout)',
        description: 'Mô tả từ backend API',
        default: 15,
        min: 1,
        max: 1440,
        unit: 'phút',
        updated_by: 'admin-1',
        updated_at: new Date().toISOString(),
      },
    ]);

    await renderComponent();

    await waitFor(() => {
      expect(screen.getByDisplayValue('20')).toBeTruthy();
    });
  });

  it('allows adding and removing rental month option tags cleanly without typing glitches', async () => {
    await renderComponent();

    // Verify initial tags: 6, 12, 18
    expect(screen.getByText('6 tháng')).toBeTruthy();
    expect(screen.getByText('12 tháng')).toBeTruthy();
    expect(screen.getByText('18 tháng')).toBeTruthy();

    // Remove 18 tháng
    const removeBtn = screen.getByTitle('Xóa gói 18 tháng');
    fireEvent.click(removeBtn);
    expect(screen.queryByText('18 tháng')).toBeNull();

    // Add 24 tháng
    const addInput = screen.getByPlaceholderText('+ Số tháng');
    fireEvent.change(addInput, { target: { value: '24' } });
    const addBtn = screen.getByRole('button', { name: /thêm/i });
    fireEvent.click(addBtn);

    expect(screen.getByText('24 tháng')).toBeTruthy();
  });
});
