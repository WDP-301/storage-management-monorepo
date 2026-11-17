import { describe, expect, it } from 'vitest';
import { settlementRecord } from '../../test-utils/settlement-fixtures';
import {
  buildRefundInput,
  initRefundProof,
  needsMissingRefundBank,
  validateRefundProof,
} from './refund-proof-form';

const PROOF = { fileKey: 'uploads/1-ck.jpg', name: 'ck.jpg', mimeType: 'image/jpeg' };

describe('refund proof form', () => {
  it('requires a verified bank account when the settlement has none and money is owed', () => {
    const record = settlementRecord({
      status: 'AWAITING_REFUND',
      bank_account: null,
      customer_bank_account: null,
      totals: {
        deposit_amount: 2_000_000,
        credits_total: 0,
        deductions_total: 0,
        refund_amount: 2_000_000,
        shortfall_amount: 0,
      },
    });
    expect(needsMissingRefundBank(record)).toBe(true);

    const state = { ...initRefundProof(record), evidence: [PROOF] };
    expect(validateRefundProof(state, record)).toBe('Chọn ngân hàng nhận tiền hoàn.');

    const verifiedState = {
      ...state,
      bank: {
        bankBin: '970436',
        accountNo: '0123456789',
        verified: {
          bankBin: '970436',
          bankName: 'Vietcombank',
          accountNo: '0123456789',
          accountName: 'NGUYEN VAN A',
        },
      },
    };
    expect(validateRefundProof(verifiedState, record)).toBeNull();
    expect(buildRefundInput(verifiedState, record)).toEqual({
      evidence: [PROOF],
      bankAccount: { bankBin: '970436', accountNo: '0123456789' },
      bankOverrideReason: 'Khách cung cấp qua kênh khác',
    });
  });

  it('skips bank inputs when the settlement already carries a bank account', () => {
    const record = settlementRecord({
      status: 'AWAITING_REFUND',
      bank_account: {
        bankBin: '970436',
        bankName: 'Vietcombank',
        accountNo: '0123456789',
        accountName: 'NGUYEN VAN A',
      },
    });
    expect(needsMissingRefundBank(record)).toBe(false);

    const state = { ...initRefundProof(record), evidence: [PROOF], transferRef: 'FT99' };
    expect(validateRefundProof(state, record)).toBeNull();
    expect(buildRefundInput(state, record)).toEqual({ evidence: [PROOF], transferRef: 'FT99' });
  });

  it('skips bank inputs when refund amount is zero', () => {
    const record = settlementRecord({
      status: 'AWAITING_REFUND',
      bank_account: null,
      totals: {
        deposit_amount: 2_000_000,
        credits_total: 0,
        deductions_total: 2_000_000,
        refund_amount: 0,
        shortfall_amount: 0,
      },
    });
    expect(needsMissingRefundBank(record)).toBe(false);

    const state = { ...initRefundProof(record), evidence: [PROOF] };
    expect(validateRefundProof(state, record)).toBeNull();
    expect(buildRefundInput(state, record)).toEqual({ evidence: [PROOF] });
  });
});
