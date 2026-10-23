import type { ContractInvoiceRecord } from '@storage/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvoicesApi } from '../../lib/invoices-api';
import { ContractInvoicesSection } from './ContractInvoicesSection';

const invoice = (over: Partial<ContractInvoiceRecord> = {}): ContractInvoiceRecord => ({
  id: 'inv-2',
  invoice_no: 'INV-2',
  kind: 'RENEWAL',
  period_no: 2,
  status: 'ISSUED',
  start_at: '2026-10-01T00:00:00.000Z',
  end_at: '2026-11-01T00:00:00.000Z',
  due_at: '2026-10-05T00:00:00.000Z',
  issued_at: '2026-09-25T00:00:00.000Z',
  total: 1_500_000,
  paid_amount: 0,
  amount_due: 1_500_000,
  is_overdue: true,
  payments: [],
  ...over,
});

describe('ContractInvoicesSection', () => {
  afterEach(() => vi.restoreAllMocks());

  it('records a cash payment on an overdue invoice and shows it as paid', async () => {
    vi.spyOn(InvoicesApi, 'listForContract').mockResolvedValue([invoice()]);
    const record = vi.spyOn(InvoicesApi, 'recordPayment').mockResolvedValue(
      invoice({
        status: 'PAID',
        paid_amount: 1_500_000,
        amount_due: 0,
        is_overdue: false,
        payments: [
          {
            id: 'pay-1',
            payment_no: 'PAY-1',
            method: 'CASH',
            amount: 1_500_000,
            paid_at: '2026-10-22T03:00:00.000Z',
            is_manual: true,
            transfer_ref: null,
            evidence: [],
            note: 'Khách trả tại quầy',
            recorded_by: { id: 'ops-1', full_name: 'Ops One' },
          },
        ],
      }),
    );
    const onChanged = vi.fn();
    render(<ContractInvoicesSection contractId="c-1" onChanged={onChanged} />);

    expect(await screen.findByText('Quá hạn')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận thanh toán' }));
    fireEvent.click(screen.getByLabelText('Tiền mặt'));
    fireEvent.change(screen.getByLabelText('Ghi chú'), {
      target: { value: 'Khách trả tại quầy' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đã thu' }));

    await waitFor(() =>
      expect(record).toHaveBeenCalledWith('c-1', 'inv-2', {
        method: 'CASH',
        amount: 1_500_000,
        note: 'Khách trả tại quầy',
      }),
    );
    expect(await screen.findByText('Đã thanh toán')).toBeTruthy();
    expect(screen.getByText('Ghi nhận bởi Ops One')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ghi nhận thanh toán' })).toBeNull();
    expect(onChanged).toHaveBeenCalled();
  });

  it('blocks a transfer without reference or photo before calling the API', async () => {
    vi.spyOn(InvoicesApi, 'listForContract').mockResolvedValue([invoice()]);
    const record = vi.spyOn(InvoicesApi, 'recordPayment');
    render(<ContractInvoicesSection contractId="c-1" onChanged={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Ghi nhận thanh toán' }));
    fireEvent.change(screen.getByLabelText('Ghi chú'), { target: { value: 'Sai nội dung' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đã thu' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/mã giao dịch/);
    expect(record).not.toHaveBeenCalled();
  });

  it('closes the form and reloads when the invoice was paid meanwhile', async () => {
    const list = vi
      .spyOn(InvoicesApi, 'listForContract')
      .mockResolvedValueOnce([invoice()])
      .mockResolvedValueOnce([
        invoice({ status: 'PAID', is_overdue: false, amount_due: 0, paid_amount: 1_500_000 }),
      ]);
    vi.spyOn(InvoicesApi, 'recordPayment').mockRejectedValue(
      Object.assign(new Error('Hóa đơn này không còn nhận thanh toán'), { status: 409 }),
    );
    render(<ContractInvoicesSection contractId="c-1" onChanged={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Ghi nhận thanh toán' }));
    fireEvent.click(screen.getByLabelText('Tiền mặt'));
    fireEvent.change(screen.getByLabelText('Ghi chú'), { target: { value: 'Trả tại quầy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đã thu' }));

    expect(await screen.findByText('Đã thanh toán')).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Xác nhận đã thu' })).toBeNull();
  });

  it('offers no payment on a paid or voided invoice', async () => {
    vi.spyOn(InvoicesApi, 'listForContract').mockResolvedValue([
      invoice({ id: 'a', status: 'PAID', is_overdue: false, amount_due: 0 }),
      invoice({ id: 'b', invoice_no: 'INV-3', status: 'VOID', is_overdue: false, amount_due: 0 }),
    ]);
    render(<ContractInvoicesSection contractId="c-1" onChanged={vi.fn()} />);

    expect(await screen.findByText('Đã hủy')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ghi nhận thanh toán' })).toBeNull();
  });
});
