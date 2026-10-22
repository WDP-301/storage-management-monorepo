import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiError } from '../../lib/api';
import { BanksApi } from '../../lib/banks-api';
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

const VERIFIED = { ...ACCOUNT, bankBin: '970436' };
const checkButton = () => screen.getByRole('button', { name: 'Kiểm tra' });

const renderForm = () => {
  vi.spyOn(BanksApi, 'list').mockResolvedValue([
    { bin: '970436', shortName: 'Vietcombank', name: 'Ngân hàng TMCP Ngoại thương Việt Nam' },
  ]);
  const verify = vi.spyOn(BanksApi, 'verify').mockResolvedValue(VERIFIED);
  const record = settlementRecord({ customer_bank_account: ACCOUNT });
  const preview = vi
    .spyOn(SettlementsApi, 'preview')
    .mockResolvedValue({ ...record, version: PREVIEWED });
  const onApproved = vi.fn();
  render(<SettlementDecisionForm record={record} onApproved={onApproved} onStale={vi.fn()} />);
  return { record, preview, onApproved, verify };
};

const verifyAccount = async () => {
  await screen.findByRole('option', { name: /Vietcombank/ });
  fireEvent.click(checkButton());
  await waitFor(() => expect(approveButton().disabled).toBe(false));
};

describe('SettlementDecisionForm', () => {
  afterEach(() => vi.restoreAllMocks());

  it('approves the figures the server previewed, with their version', async () => {
    const { record, preview, onApproved, verify } = renderForm();
    const approved = { ...record, status: 'AWAITING_REFUND' as const };
    const approve = vi.spyOn(SettlementsApi, 'approve').mockResolvedValue(approved);

    await waitFor(() => expect(preview).toHaveBeenCalled());
    expect(approveButton().disabled).toBe(true);
    await screen.findByRole('option', { name: /Vietcombank/ });
    fireEvent.click(checkButton());
    await waitFor(() => expect(approveButton().disabled).toBe(false));
    expect(verify).toHaveBeenCalledWith('970436', '0123456789');
    expect(screen.getByDisplayValue('NGUYEN VAN AN')).toBeTruthy();
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
      bankAccount: { bankBin: '970436', accountNo: '0123456789' },
    });
  });

  it('previews again after a decision changes and blocks approval until it returns', async () => {
    const { preview } = renderForm();
    await verifyAccount();

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

    await verifyAccount();
    fireEvent.click(approveButton());
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận duyệt' }));

    expect(await screen.findByText(/Số liệu quyết toán vừa thay đổi/)).toBeTruthy();
    await waitFor(() => expect(preview).toHaveBeenCalledTimes(2));
    expect(onApproved).not.toHaveBeenCalled();
  });

  it('clears the verification when the number changes and shows why a check failed', async () => {
    const { verify } = renderForm();
    await screen.findByRole('option', { name: /Vietcombank/ });
    fireEvent.click(checkButton());
    await waitFor(() => expect(approveButton().disabled).toBe(false));

    fireEvent.change(screen.getByLabelText('Số tài khoản'), { target: { value: '99998888' } });
    expect(approveButton().disabled).toBe(true);
    expect(screen.queryByDisplayValue('NGUYEN VAN AN')).toBeNull();

    verify.mockRejectedValue(
      Object.assign(new Error('x'), {
        status: 400,
        code: 'BANK_ACCOUNT_INVALID',
        details: { reason: 'ACCOUNT' },
      }),
    );
    fireEvent.click(checkButton());
    expect(
      await screen.findByText('Số tài khoản không tồn tại tại ngân hàng đã chọn'),
    ).toBeTruthy();
    expect(approveButton().disabled).toBe(true);
  });

  it('lists what is missing instead of asking the server', async () => {
    renderForm();
    await screen.findByRole('option', { name: /Vietcombank/ });
    fireEvent.click(checkButton());
    await waitFor(() => expect(approveButton().disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('Số tài khoản'), { target: { value: '12' } });
    expect(approveButton().disabled).toBe(true);
  });
});
