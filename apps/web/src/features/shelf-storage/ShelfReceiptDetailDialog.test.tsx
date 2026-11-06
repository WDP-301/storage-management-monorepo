import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { receiptFixture } from './fixtures';
import { ShelfReceiptDetailDialog } from './ShelfReceiptDetailDialog';

const api = vi.hoisted(() => ({ receipt: vi.fn(), voidReceipt: vi.fn() }));
const auth = vi.hoisted(() => ({ roles: ['FACILITY_MANAGER'] as string[] }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const tickets = vi.hoisted(() => ({ getOne: vi.fn() }));
vi.mock('../../lib/shelf-storage-api', () => ({ ShelfStorageApi: api }));
vi.mock('../../lib/api', () => ({ TicketsApi: tickets, UploadsApi: { downloadUrl: vi.fn() } }));
vi.mock('../../lib/toast', () => ({ useAppToast: () => toast }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u', roles: auth.roles } }),
}));

describe('ShelfReceiptDetailDialog', () => {
  beforeEach(() => {
    auth.roles = ['FACILITY_MANAGER'];
    api.receipt.mockResolvedValue(receiptFixture());
  });
  afterEach(() => vi.clearAllMocks());

  it('keeps void disabled under 3 characters, voids, refreshes and notifies', async () => {
    api.voidReceipt.mockResolvedValue(receiptFixture({ status: 'VOIDED' }));
    const onChanged = vi.fn();
    render(<ShelfReceiptDetailDialog receiptId="r1" onClose={vi.fn()} onChanged={onChanged} />);
    const button = await screen.findByRole('button', { name: 'Hủy phiếu' });
    expect((button as HTMLButtonElement).disabled).toBe(true);

    const reason = screen.getByLabelText('Lý do hủy phiếu');
    fireEvent.change(reason, { target: { value: ' ab ' } });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(reason, { target: { value: 'Nhập nhầm số lượng' } });
    fireEvent.click(button);

    await waitFor(() =>
      expect(api.voidReceipt).toHaveBeenCalledWith('r1', { reason: 'Nhập nhầm số lượng' }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalled();
    expect(api.receipt).toHaveBeenCalledTimes(2);
  });

  it('shows the mapped message when the stock is already gone', async () => {
    api.voidReceipt.mockRejectedValue(
      Object.assign(new Error('raw'), {
        status: 409,
        code: 'SHELF_STOCK_INSUFFICIENT',
        details: { items: [{ name: 'Thùng sách', requested: 3, available: 1 }] },
      }),
    );
    render(<ShelfReceiptDetailDialog receiptId="r1" onClose={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Lý do hủy phiếu'), {
      target: { value: 'Nhập nhầm' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hủy phiếu' }));
    expect(await screen.findByText(/Thùng sách: còn 1, cần 3/)).toBeTruthy();
  });

  it('hides void for roles that cannot void and for voided receipts', async () => {
    auth.roles = ['FACILITY_STAFF'];
    const { unmount } = render(<ShelfReceiptDetailDialog receiptId="r1" onClose={vi.fn()} />);
    await screen.findByText('Thùng sách');
    expect(screen.queryByLabelText('Lý do hủy phiếu')).toBeNull();
    unmount();

    auth.roles = ['ADMIN'];
    api.receipt.mockResolvedValue(
      receiptFixture({
        status: 'VOIDED',
        void: { at: '2026-11-07T04:00:00.000Z', by: null, reason: 'Sai phiếu' },
      }),
    );
    render(<ShelfReceiptDetailDialog receiptId="r1" onClose={vi.fn()} />);
    expect(await screen.findByText(/Sai phiếu/)).toBeTruthy();
    expect(screen.queryByLabelText('Lý do hủy phiếu')).toBeNull();
  });

  it('keeps the dispute summary when the ticket detail is refused', async () => {
    api.receipt.mockResolvedValue(
      receiptFixture({
        openDisputeTicket: {
          id: 't1',
          ticketNo: 'TK-1',
          status: 'OPEN',
          subject: 'Sai số lượng',
          createdAt: '2026-11-07T05:00:00.000Z',
        },
      }),
    );
    tickets.getOne.mockRejectedValue(Object.assign(new Error('no'), { status: 403 }));
    render(<ShelfReceiptDetailDialog receiptId="r1" onClose={vi.fn()} />);
    expect(await screen.findByText(/Sai số lượng/)).toBeTruthy();
    await waitFor(() => expect(tickets.getOne).toHaveBeenCalledWith('t1'));
    expect(screen.getByText('Khách báo phiếu này sai')).toBeTruthy();
  });
});
