import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { receiptFixture, stockFixture } from './fixtures';
import { ShelfRecordsTab } from './ShelfRecordsTab';

const api = vi.hoisted(() => ({
  warehouseStock: vi.fn(),
  warehouseReceipts: vi.fn(),
  warehousePickupRequests: vi.fn(),
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

  it('shows the permission message when a panel is refused', async () => {
    api.warehouseStock.mockRejectedValue(Object.assign(new Error('x'), { status: 403 }));
    render(<ShelfRecordsTab warehouseId="w1" />);
    expect(await screen.findByText(/Bạn không quản lý cơ sở này/)).toBeTruthy();
  });
});
