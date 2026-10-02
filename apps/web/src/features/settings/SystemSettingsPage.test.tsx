import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemSettingsPage } from './SystemSettingsPage';

describe('SystemSettingsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders system settings page header, search and tabs', () => {
    render(<SystemSettingsPage />);

    expect(screen.getByText('Cấu hình tham số hệ thống')).toBeTruthy();
    expect(screen.getByPlaceholderText('Tìm kiếm tham số...')).toBeTruthy();
    expect(screen.getByRole('button', { name: /lưu thay đổi/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /mặc định/i })).toBeTruthy();
  });

  it('filters configuration items by category tabs', () => {
    render(<SystemSettingsPage />);

    // Initially all configs are shown
    expect(screen.getByText('Thời gian giữ chỗ tạm thời (Hold timeout)')).toBeTruthy();
    expect(screen.getByText('Thuế giá trị gia tăng (VAT)')).toBeTruthy();

    // Click on 'Tài chính & Phí' tab
    const billingTab = screen.getByRole('button', { name: /tài chính & phí/i });
    fireEvent.click(billingTab);

    // Billing item should be present, booking item should be filtered out
    expect(screen.getByText('Thuế giá trị gia tăng (VAT)')).toBeTruthy();
    expect(screen.queryByText('Thời gian giữ chỗ tạm thời (Hold timeout)')).toBeNull();
  });

  it('filters configuration items by search query', () => {
    render(<SystemSettingsPage />);

    const searchInput = screen.getByPlaceholderText('Tìm kiếm tham số...');
    fireEvent.change(searchInput, { target: { value: 'VAT' } });

    expect(screen.getByText('Thuế giá trị gia tăng (VAT)')).toBeTruthy();
    expect(screen.queryByText('Thời gian giữ chỗ tạm thời (Hold timeout)')).toBeNull();
  });

  it('displays empty state when search finds no results', () => {
    render(<SystemSettingsPage />);

    const searchInput = screen.getByPlaceholderText('Tìm kiếm tham số...');
    fireEvent.change(searchInput, { target: { value: 'non_existent_key_xyz' } });

    expect(screen.getByText('Không tìm thấy tham số cấu hình phù hợp với từ khóa.')).toBeTruthy();
  });

  it('resets values back to default when clicking Mặc định', () => {
    render(<SystemSettingsPage />);

    // Find the VAT input (default 8)
    const vatInput = screen.getByDisplayValue('8');
    fireEvent.change(vatInput, { target: { value: '20' } });
    expect(screen.getByDisplayValue('20')).toBeTruthy();

    // Click Reset
    const resetBtn = screen.getByRole('button', { name: /mặc định/i });
    fireEvent.click(resetBtn);

    expect(screen.getByText('Đã khôi phục toàn bộ tham số về giá trị mặc định.')).toBeTruthy();
    expect(screen.getByDisplayValue('8')).toBeTruthy();
  });

  it('triggers save action and displays feedback message', async () => {
    render(<SystemSettingsPage />);

    const saveBtn = screen.getByRole('button', { name: /lưu thay đổi/i });
    fireEvent.click(saveBtn);

    expect(
      await screen.findByText('Đã lưu cấu hình tham số hệ thống thành công (Mock UI).', undefined, {
        timeout: 2500,
      }),
    ).toBeTruthy();
  });
});
