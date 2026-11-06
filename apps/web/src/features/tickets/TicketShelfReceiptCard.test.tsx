import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServiceTicketRecord } from '../../types/service-tickets';
import { receiptFixture } from '../shelf-storage/fixtures';
import { TicketShelfReceiptCard } from './TicketShelfReceiptCard';

const api = vi.hoisted(() => ({ receipt: vi.fn() }));
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
});
