import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiError } from '../../lib/api';
import { SettlementsApi } from '../../lib/settlements-api';
import { settlementRecord } from '../../test-utils/settlement-fixtures';
import type { RefundBankAccount } from '../../types/settlement';
import { SettlementDecisionForm } from './SettlementDecisionForm';

const ACCOUNT: RefundBankAccount = {
  bankBin: '970436',
  bankName: 'Vietcombank',
  accountNo: '0123456789',
  accountName: 'NGUYEN VAN AN',
};
const PREVIEWED = 'b'.repeat(64);

const approveButton = () =>
  screen.getByRole('button', { name: 'Duyệt quyết toán' }) as HTMLButtonElement;

const renderForm = () => {
  const record = settlementRecord({ customer_bank_account: ACCOUNT });
  const preview = vi
    .spyOn(SettlementsApi, 'preview')
    .mockResolvedValue({ ...record, version: PREVIEWED });
  const onApproved = vi.fn();
  render(<SettlementDecisionForm record={record} onApproved={onApproved} onStale={vi.fn()} />);
  return { record, preview, onApproved };
};

describe('SettlementDecisionForm', () => {
  afterEach(() => vi.restoreAllMocks());

  it('approves the figures the server previewed, with their version', async () => {
    const { record, preview, onApproved } = renderForm();
    const approved = { ...record, status: 'AWAITING_REFUND' as const };
    const approve = vi.spyOn(SettlementsApi, 'approve').mockResolvedValue(approved);

    await waitFor(() => expect(approveButton().disabled).toBe(false));
    expect(preview).toHaveBeenCalledWith('c-1', {
      damageDecisions: [{ index: 0, amount: 200000 }],
      creditDecisions: [],
      waivedLines: [],
    });

    fireEvent.click(approveButton());
    expect(screen.getByText(/Hoàn cho khách 3\.000\.000 đ\./)).toBeTruthy();
    expect(approve).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận duyệt' }));
    await waitFor(() => expect(onApproved).toHaveBeenCalledWith(approved));
    expect(approve).toHaveBeenCalledWith('c-1', {
      damageDecisions: [{ index: 0, amount: 200000 }],
      creditDecisions: [],
      waivedLines: [],
      expectedVersion: PREVIEWED,
      bankAccount: ACCOUNT,
    });
  });

  it('previews again after a decision changes and blocks approval until it returns', async () => {
    const { preview } = renderForm();
    await waitFor(() => expect(approveButton().disabled).toBe(false));

    fireEvent.click(screen.getByRole('radio', { name: 'Miễn' }));
    expect(approveButton().disabled).toBe(true);
    await waitFor(() =>
      expect(preview).toHaveBeenLastCalledWith('c-1', {
        damageDecisions: [{ index: 0, waived: true }],
        creditDecisions: [],
        waivedLines: [],
      }),
    );
    await waitFor(() => expect(approveButton().disabled).toBe(false));
  });

  it('reloads the preview when the figures changed before approval', async () => {
    const { preview, onApproved } = renderForm();
    const changed = Object.assign(new Error('changed'), {
      status: 409,
      code: 'SETTLEMENT_CHANGED',
    }) as ApiError;
    vi.spyOn(SettlementsApi, 'approve').mockRejectedValue(changed);

    await waitFor(() => expect(approveButton().disabled).toBe(false));
    fireEvent.click(approveButton());
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận duyệt' }));

    expect(await screen.findByText(/Số liệu quyết toán vừa thay đổi/)).toBeTruthy();
    await waitFor(() => expect(preview).toHaveBeenCalledTimes(2));
    expect(onApproved).not.toHaveBeenCalled();
  });

  it('lists what is missing instead of asking the server', async () => {
    renderForm();
    await waitFor(() => expect(approveButton().disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('Số tài khoản'), { target: { value: '12' } });
    await waitFor(() => expect(approveButton().disabled).toBe(false));

    fireEvent.click(approveButton());
    expect(screen.getByText('Số tài khoản gồm 4–30 chữ hoặc số.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xác nhận duyệt' })).toBeNull();
  });
});
