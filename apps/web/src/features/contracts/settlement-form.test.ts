import { describe, expect, it } from 'vitest';
import { settlementLine, settlementRecord } from '../../test-utils/settlement-fixtures';
import type { RefundBankAccount, SettlementTotals } from '../../types/settlement';
import { OTHER_BANK } from './refund-account-form';
import { validateRefundProof } from './refund-proof-form';
import {
  approvalProblems,
  buildApproveInput,
  buildDecisions,
  DEFAULT_OVERRIDE_REASON,
  initSettlementForm,
  parseAmount,
} from './settlement-form';

const CUSTOMER_ACCOUNT: RefundBankAccount = {
  bankBin: '970436',
  bankName: 'Vietcombank',
  accountNo: '0123456789',
  accountName: 'NGUYEN VAN AN',
};
const TOTALS = settlementRecord().totals as SettlementTotals;
const VCB_FORM = { bankBin: '970436', bankName: '', accountNo: '0123456789' };

const REVIEW_CREDIT = settlementLine({
  type: 'REVIEW_PAYMENT_CREDIT',
  direction: 'CREDIT',
  description: 'Khoản tiền cần kiểm tra — hoá đơn INV-2',
  amount: 0,
  needs_decision: true,
  payment_id: 'pay-1',
  included: null,
});
const OVERSTAY = settlementLine({ type: 'OVERSTAY', description: 'Quá hạn trả kho 2 ngày' });

describe('settlement form', () => {
  it('pre-fills a proposed fee as an explicit charge and leaves an unpriced damage undecided', () => {
    const record = settlementRecord();
    record.return.damages.push({
      index: 1,
      description: 'Trầy sàn',
      severity: 'MINOR',
      evidence: [],
      proposed_fee: null,
    });
    const form = initSettlementForm(record);
    expect(form.damages).toEqual({
      0: { mode: 'charge', amount: '200000' },
      1: { mode: null, amount: '' },
    });
    expect(buildDecisions(form, record).damageDecisions).toEqual([{ index: 0, amount: 200000 }]);
    expect(approvalProblems(form, record)).toContain('Hư hỏng 2: nhập số tiền hoặc chọn Miễn.');
  });

  it('defaults the override reason when the customer gave no account (older app)', () => {
    const form = initSettlementForm(settlementRecord());
    expect(form.bankReason).toBe(DEFAULT_OVERRIDE_REASON);
    expect(form.bank.bankBin).toBe('');
  });

  it('pre-fills the account the customer gave and needs no reason to keep it', () => {
    const record = settlementRecord({ customer_bank_account: CUSTOMER_ACCOUNT });
    const form = initSettlementForm(record);
    expect(form.bank).toEqual({ ...VCB_FORM, accountName: 'NGUYEN VAN AN' });
    expect(form.bankReason).toBe('');
    expect(approvalProblems(form, record)).toEqual([]);
    const input = buildApproveInput(form, record);
    expect(input.bankAccount).toEqual({ ...CUSTOMER_ACCOUNT });
    expect(input.bankOverrideReason).toBeUndefined();
  });

  it('asks for a reason once the reviewer changes the customer account', () => {
    const record = settlementRecord({ customer_bank_account: CUSTOMER_ACCOUNT });
    const form = initSettlementForm(record);
    form.bank = { ...form.bank, accountNo: '999988887777' };
    expect(approvalProblems(form, record)).toEqual([
      'Nhập lý do dùng tài khoản khác tài khoản khách đã cung cấp.',
    ]);
    form.bankReason = '  Khách đổi qua hotline ';
    const input = buildApproveInput(form, record);
    expect(input.bankOverrideReason).toBe('Khách đổi qua hotline');
    expect(input.bankAccount?.accountNo).toBe('999988887777');
  });

  it('sends a typed account for an unlisted bank, holder name normalized like the bank prints it', () => {
    const record = settlementRecord();
    const form = initSettlementForm(record);
    expect(approvalProblems(form, record)).toEqual(['Chọn ngân hàng nhận tiền hoàn.']);
    form.bank = {
      bankBin: OTHER_BANK,
      bankName: 'Ngân hàng Địa phương',
      accountNo: '12345678',
      accountName: 'Nguyễn  Văn   Đức',
    };
    expect(approvalProblems(form, record)).toEqual([]);
    expect(buildApproveInput(form, record)).toEqual({
      damageDecisions: [{ index: 0, amount: 200000 }],
      creditDecisions: [],
      waivedLines: [],
      expectedVersion: 'a'.repeat(64),
      bankAccount: {
        bankBin: null,
        bankName: 'Ngân hàng Địa phương',
        accountNo: '12345678',
        accountName: 'NGUYEN VAN DUC',
      },
      bankOverrideReason: DEFAULT_OVERRIDE_REASON,
    });
  });

  it('needs no account when nothing is refunded', () => {
    const record = settlementRecord({
      totals: { ...TOTALS, refund_amount: 0, shortfall_amount: 50_000 },
    });
    const form = initSettlementForm(record);
    expect(approvalProblems(form, record)).toEqual([]);
    const input = buildApproveInput(form, record);
    expect(input.bankAccount).toBeUndefined();
    expect(input.bankOverrideReason).toBeUndefined();
  });

  it('requires a decision on reviewed payments and a reason for each waiver', () => {
    const record = settlementRecord({
      lines: [...settlementRecord().lines, REVIEW_CREDIT, OVERSTAY],
      totals: { ...TOTALS, refund_amount: 0 },
    });
    const form = initSettlementForm(record);
    form.waived.OVERSTAY = { on: true, reason: ' ' };
    expect(approvalProblems(form, record)).toEqual([
      'Chọn Tính hoặc Không tính cho "Khoản tiền cần kiểm tra — hoá đơn INV-2".',
      'Nhập lý do miễn phí quá hạn.',
    ]);
    // An unfinished waiver is not previewed, so the preview never fails on it.
    expect(buildDecisions(form, record).waivedLines).toEqual([]);

    form.credits['pay-1'] = false;
    form.waived.OVERSTAY = { on: true, reason: 'Khách báo trước qua hotline' };
    form.damages[0] = { mode: 'waive', amount: '200000' };
    expect(approvalProblems(form, record)).toEqual([]);
    expect(buildDecisions(form, record)).toEqual({
      damageDecisions: [{ index: 0, waived: true }],
      creditDecisions: [{ paymentId: 'pay-1', include: false }],
      waivedLines: [{ type: 'OVERSTAY', reason: 'Khách báo trước qua hotline' }],
    });
  });

  it('only decides lines the latest preview still has', () => {
    const record = settlementRecord();
    const form = initSettlementForm(settlementRecord({ lines: [REVIEW_CREDIT] }));
    form.credits['pay-1'] = true;
    expect(buildDecisions(form, record).creditDecisions).toEqual([]);
  });

  it('refuses approval while the deposit is unknown', () => {
    const record = settlementRecord({ deposit: null, totals: null });
    const problems = approvalProblems(initSettlementForm(record), record);
    expect(problems).toEqual(['Không xác định được tiền cọc đã nộp — chưa thể duyệt.']);
  });

  it('accepts only whole VND amounts within the limit', () => {
    expect(parseAmount(' 150000 ')).toBe(150000);
    expect(parseAmount('0')).toBe(0);
    for (const bad of ['', '-1', '1.5', '1e3', '1000000001', 'abc']) {
      expect(parseAmount(bad)).toBeNull();
    }
  });

  it('needs a transfer reference or evidence to confirm the refund', () => {
    const file = { fileKey: 'uploads/1-slip.jpg', name: 'slip.jpg', mimeType: 'image/jpeg' };
    expect(validateRefundProof({ evidence: [], transferRef: '  ', note: '' })).toBe(
      'Nhập mã giao dịch hoặc đính kèm ảnh chứng từ chuyển khoản.',
    );
    expect(validateRefundProof({ evidence: [], transferRef: 'FT2610', note: '' })).toBeNull();
    expect(validateRefundProof({ evidence: [file], transferRef: '', note: '' })).toBeNull();
    expect(validateRefundProof({ evidence: Array(6).fill(file), transferRef: '', note: '' })).toBe(
      'Tối đa 5 ảnh chứng từ.',
    );
  });
});
