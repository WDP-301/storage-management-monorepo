import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServiceTicketRecord } from '../../types/service-tickets';
import { receiptFixture } from '../shelf-storage/fixtures';
import { TicketShelfReceiptCard } from './TicketShelfReceiptCard';

const api = vi.hoisted(() => ({ receipt: vi.fn(), voidReceipt: vi.fn() }));
vi.mock('../../lib/shelf-storage-api', () => ({ ShelfStorageApi: api }));
vi.mock('../../lib/api', () => ({ TicketsApi: {}, UploadsApi: { downloadUrl: vi.fn() } }));
vi.mock('../../lib/toast', () => ({ useAppToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u', roles: ['FACILITY_MANAGER'] } }),
}));

const ticket = (extra: object) => ({ id: 't1', ...extra }) as unknown as ServiceTicketRecord;

describe('TicketShelfReceiptCard', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders nothing without a linked receipt', () => {
    const { container } = render(
      <TicketShelfReceiptCard ticket={ticket({ shelf_receipt: null })} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows the receipt and opens it in the detail dialog', async () => {
    api.receipt.mockResolvedValue(receiptFixture());
    render(
      <TicketShelfReceiptCard
        ticket={ticket({
          shelf_receipt: { id: 'r1', code: 'PG-1', type: 'DROP_OFF', status: 'ACTIVE' },
        })}
      />,
    );
    expect(screen.getByText(/PG-1 · Gửi đồ · Hiệu lực/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xem phiếu' }));
    expect(await screen.findByText('Thùng sách')).toBeTruthy();
    expect(api.receipt).toHaveBeenCalledWith('r1');
  });

  it('shows the status it is given, so a reloaded ticket replaces a stale one', () => {
    const linked = (status: string) =>
      ticket({ shelf_receipt: { id: 'r1', code: 'PG-1', type: 'DROP_OFF', status } });
    const { rerender } = render(<TicketShelfReceiptCard ticket={linked('ACTIVE')} />);
    expect(screen.getByText(/Hiệu lực/)).toBeTruthy();
    rerender(<TicketShelfReceiptCard ticket={linked('VOIDED')} />);
    expect(screen.queryByText(/Hiệu lực/)).toBeNull();
  });

  it('tells the page after a void from the dialog, so it can reload the ticket', async () => {
    api.receipt.mockResolvedValue(receiptFixture());
    api.voidReceipt.mockResolvedValue(receiptFixture({ status: 'VOIDED' }));
    const onChanged = vi.fn();
    render(
      <TicketShelfReceiptCard
        onChanged={onChanged}
        ticket={ticket({
          shelf_receipt: { id: 'r1', code: 'PG-1', type: 'DROP_OFF', status: 'ACTIVE' },
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Xem phiếu' }));
    fireEvent.change(await screen.findByLabelText('Lý do hủy phiếu'), {
      target: { value: 'Nhập nhầm số lượng' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hủy phiếu' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });
});
