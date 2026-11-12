import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { receiptFixture, stockFixture } from './fixtures';
import { ShelfRecordsTab } from './ShelfRecordsTab';

const api = vi.hoisted(() => ({
  warehouseStock: vi.fn(),
  warehouseReceipts: vi.fn(),
  warehousePickupRequests: vi.fn(),
  warehouseDropOffRequests: vi.fn(),
  receipt: vi.fn(),
  voidReceipt: vi.fn(),
}));
vi.mock('../../lib/shelf-storage-api', () => ({ ShelfStorageApi: api }));
vi.mock('../../lib/toast', () => ({
  useAppToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'a', roles: ['ADMIN'] } }),
}));

const meta = { page: 1, limit: 20, total: 2, totalPages: 1 };

describe('ShelfRecordsTab', () => {
  beforeEach(() => {
    api.warehouseStock.mockResolvedValue([
      stockFixture({
        openRequest: {
          status: 'PENDING',
          requestedFor: '2026-11-08T03:00:00.000Z',
        } as never,
      }),
      stockFixture({
        contractId: 'c2',
        contractNo: 'HD-002',
        shelf: { id: 's2', code: 'K-02', name: 'Kệ 02' },
        items: [],
        totalQuantity: 0,
        returnOpen: true,
      }),
    ]);
    api.warehouseReceipts.mockResolvedValue({
      receipts: [
        receiptFixture(),
        receiptFixture({
          id: 'r2',
          code: 'PL-20261107-BBBB2222',
          type: 'PICK_UP',
          openDisputeTicket: {
            id: 't1',
            ticketNo: 'TK-1',
            status: 'OPEN',
            subject: 'Sai số lượng',
            createdAt: '2026-11-07T05:00:00.000Z',
          },
        }),
      ],
      meta,
    });
    api.warehousePickupRequests.mockResolvedValue([]);
    api.warehouseDropOffRequests.mockResolvedValue([
      {
        id: 'd1',
        status: 'CONFIRMED',
        contractId: 'c1',
        contractNo: 'HD-001',
        shelf: { id: 's1', code: 'K-01', name: 'Kệ 01' },
        warehouse: { id: 'w1', code: 'KK-02', name: 'Kho kệ 2' },
        customer: { id: 'u1', fullName: 'Nguyễn An', phone: '0900000001' },
        requestedFor: '2026-11-13T02:00:00.000Z',
        note: 'Mang thêm thùng',
        lines: [
          { itemId: 'i1', name: 'Thùng sách', quantity: 2 },
          { itemId: null, name: 'Xe đạp', quantity: 1 },
        ],
        createdAt: '2026-11-12T02:00:00.000Z',
        confirmedAt: '2026-11-12T03:00:00.000Z',
        confirmedBy: { id: 'st1', fullName: 'Nhân viên Bình' },
        cancelledAt: null,
        cancelledBy: null,
        completedAt: null,
        completedReceiptId: null,
      },
    ]);
  });
  afterEach(() => vi.clearAllMocks());

  it('shows stock rows with request and return badges, and filters to stocked shelves', async () => {
    render(<ShelfRecordsTab warehouseId="w1" />);
    expect(await screen.findByText('K-01')).toBeTruthy();
    expect(screen.getByText(/Chờ chuẩn bị/)).toBeTruthy();
    expect(screen.getByText('Đang trả kệ')).toBeTruthy();
    expect(screen.getByText('Kệ trống')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Chỉ kệ có đồ'));
    expect(screen.queryByText('K-02')).toBeNull();
  });

  it('flags a disputed receipt and sends the filters to the API', async () => {
    render(<ShelfRecordsTab warehouseId="w1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Phiếu gửi / lấy' }));
    expect(await screen.findByText('PL-20261107-BBBB2222')).toBeTruthy();
    expect(screen.getByText('Khách báo sai')).toBeTruthy();
    expect(api.warehouseReceipts).toHaveBeenLastCalledWith('w1', { page: 1, limit: 20 });

    fireEvent.click(screen.getByLabelText('Chỉ phiếu khách báo sai'));
    await waitFor(() =>
      expect(api.warehouseReceipts).toHaveBeenLastCalledWith('w1', {
        page: 1,
        limit: 20,
        disputed: true,
      }),
    );
    fireEvent.click(screen.getByLabelText('Gồm phiếu đã hủy'));
    await waitFor(() =>
      expect(api.warehouseReceipts).toHaveBeenLastCalledWith('w1', {
        page: 1,
        limit: 20,
        disputed: true,
        status: 'ACTIVE',
      }),
    );
  });

  it('lists drop-off requests, marking new items, and asks for all of them on demand', async () => {
    render(<ShelfRecordsTab warehouseId="w1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Yêu cầu gửi đồ' }));
    expect(await screen.findByText(/Xe đạp ×1 \(món mới\)/)).toBeTruthy();
    expect(screen.getByText(/Thùng sách ×2/)).toBeTruthy();
    expect(screen.getByText('Đã xác nhận')).toBeTruthy();
    expect(screen.getByText('Mang thêm thùng')).toBeTruthy();
    expect(api.warehouseDropOffRequests).toHaveBeenLastCalledWith('w1', 'OPEN');
  });

  it('shows the permission message when a panel is refused', async () => {
    api.warehouseStock.mockRejectedValue(Object.assign(new Error('x'), { status: 403 }));
    render(<ShelfRecordsTab warehouseId="w1" />);
    expect(await screen.findByText(/Bạn không quản lý cơ sở này/)).toBeTruthy();
  });
});
