import { ContractSettlement } from '@entities/contract-settlement.entity';
import { ContractStatus, SettlementLineType, SettlementStatus } from '@storage/types';
import { maskRefundAccount } from './settlement-records';
import {
  customerSettlementLines,
  loadCustomerContractExtras,
  loadSettlementStatuses,
  overduePenaltyPerDay,
} from './settlement-summary.util';

const contract = (id: string, status: ContractStatus) => ({
  id,
  status,
  bookingItemId: `item-${id}`,
  // Numeric columns arrive as strings.
  monthlyPriceSnapshot: '1500000.00' as unknown as number,
});

describe('settlement read model', () => {
  it('masks all but the last four digits of a refund account', () => {
    expect(
      maskRefundAccount({
        bankBin: null,
        bankName: 'X',
        accountNo: '0123456789',
        accountName: 'A',
      }),
    ).toEqual({ bank_name: 'X', account_no_masked: '••••6789', account_name: 'A' });
    expect(maskRefundAccount(null)).toBeNull();
  });

  it('rounds the per-day overstay charge half-up to the dong', () => {
    expect(overduePenaltyPerDay('1500000', 100)).toBe(50000);
    expect(overduePenaltyPerDay('1000000', 100)).toBe(33333);
    expect(overduePenaltyPerDay('1000001', 150)).toBe(50000);
  });

  it('reports PENDING for an ENDED contract without a settlement and null before it ends', async () => {
    const em = { query: jest.fn(async () => [{ contractId: 'b', status: 'COMPLETED' }]) };
    const statuses = await loadSettlementStatuses(em as never, [
      contract('a', ContractStatus.ENDED),
      contract('b', ContractStatus.ENDED),
      contract('c', ContractStatus.ACTIVE),
    ]);
    expect([...statuses.values()]).toEqual(['PENDING', 'COMPLETED', null]);
  });

  it('shows the customer only what was decided, leaving the stored lines untouched', () => {
    const base = {
      direction: 'DEDUCTION' as const,
      description: 'x',
      quantity: 1,
      needs_decision: false,
      waived: false,
      waive_reason: null,
    };
    const stored = [
      {
        ...base,
        type: SettlementLineType.DAMAGE,
        unit_amount: 250000,
        amount: 250000,
        proposed_amount: 500000,
      },
      {
        ...base,
        type: SettlementLineType.DAMAGE,
        unit_amount: 100000,
        amount: 0,
        waived: true,
        proposed_amount: 100000,
      },
      {
        ...base,
        type: SettlementLineType.OVERSTAY,
        quantity: 3,
        unit_amount: 50000,
        amount: 0,
        waived: true,
        waive_reason: 'Nội bộ: khách VIP',
      },
      {
        ...base,
        type: SettlementLineType.REVIEW_PAYMENT_CREDIT,
        direction: 'CREDIT' as const,
        description: 'Khoản tiền cần kiểm tra',
        unit_amount: 500000,
        amount: 0,
        included: false,
        payment_id: 'p-out',
      },
      {
        ...base,
        type: SettlementLineType.REVIEW_PAYMENT_CREDIT,
        direction: 'CREDIT' as const,
        unit_amount: 200000,
        amount: 200000,
        included: true,
        payment_id: 'p-in',
      },
    ];
    const before = structuredClone(stored);

    const lines = customerSettlementLines(stored);

    expect(
      lines.map((l) => [
        l.type,
        l.unit_amount,
        l.amount,
        l.proposed_amount ?? null,
        l.waive_reason,
      ]),
    ).toEqual([
      [SettlementLineType.DAMAGE, 250000, 250000, null, null],
      [SettlementLineType.DAMAGE, 0, 0, null, null],
      [SettlementLineType.OVERSTAY, 50000, 0, null, null],
      [SettlementLineType.REVIEW_PAYMENT_CREDIT, 200000, 200000, null, null],
    ]);
    expect(lines.some((l) => l.payment_id === 'p-out')).toBe(false);
    expect(stored).toEqual(before);
  });

  it('gives the customer the frozen figures without the fees staff first proposed', async () => {
    const settlement = {
      contractId: 'a',
      status: SettlementStatus.AWAITING_REFUND,
      depositAmount: '2000000.00',
      creditsTotal: '0',
      deductionsTotal: '300000',
      refundAmount: '1700000',
      shortfallAmount: '0',
      lines: [{ type: SettlementLineType.DAMAGE, amount: 300000, proposed_amount: 500000 }],
      bankAccount: { bankBin: null, bankName: 'X', accountNo: '99990000', accountName: 'A' },
      feeInvoiceId: 'fee-1',
      approvedAt: new Date('2027-04-02'),
      completedAt: null,
    };
    const em = {
      // Deposit ledger: no row, nothing derivable.
      query: jest.fn(async () => []),
      find: jest.fn(async () => [settlement]),
    };
    const extras = await loadCustomerContractExtras(
      em as never,
      [contract('a', ContractStatus.ENDED), contract('b', ContractStatus.ACTIVE)],
      new Map(),
      100,
    );
    expect(em.find).toHaveBeenCalledWith(ContractSettlement, expect.anything());
    expect(extras.get('a')).toMatchObject({
      deposit: null,
      penaltyPerDay: 50000,
      settlement: {
        status: SettlementStatus.AWAITING_REFUND,
        deposit_amount: 2000000,
        lines: [{ amount: 300000, proposed_amount: null }],
        totals: { refund_amount: 1700000 },
        refund_account: { account_no_masked: '••••0000' },
        fee_invoice_id: 'fee-1',
      },
    });
    expect(extras.get('b')?.settlement).toBeNull();
  });
});
