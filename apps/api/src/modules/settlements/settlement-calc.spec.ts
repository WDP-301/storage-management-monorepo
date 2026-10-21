import {
  DamageSeverity,
  DepositStatus,
  InvoiceKind,
  InvoiceStatus,
  PaymentMethod,
  SettlementLineType,
} from '@storage/types';
import { type ReturnTiming, returnTiming } from './return-timing';
import {
  type CalcInvoice,
  type CalcPayment,
  computeSettlement,
  type SettlementCalcInput,
} from './settlement-calc';
import { settledDepositStatus, settlementVersion } from './settlement-totals';

const E = '2027-04-01';
const ON_TIME: ReturnTiming = {
  termEndAt: new Date('2027-04-01T00:00:00+07:00'),
  termEndDay: E,
  lastDay: '2027-03-31',
  scheduledDay: E,
  effectiveReturnDay: E,
  noticeFrom: new Date('2027-02-01T00:00:00+07:00'),
  noticeDays: 59,
  requiredNoticeDays: 30,
  early: false,
  shortNotice: false,
  shortNoticeDeduction: 0,
  overstayFromDay: E,
  overstayDays: 0,
  overstayPenaltyPerDay: 0,
  overstayPenalty: 0,
};

const invoice = (over: Partial<CalcInvoice> = {}): CalcInvoice => ({
  id: 'inv-1',
  invoiceNo: 'INV-1',
  kind: InvoiceKind.INITIAL,
  status: InvoiceStatus.ISSUED,
  startAt: new Date('2027-03-01T00:00:00+07:00'),
  dueAt: new Date('2027-03-01T00:00:00+07:00'),
  total: 800000,
  ...over,
});
const payment = (over: Partial<CalcPayment> = {}): CalcPayment => ({
  id: 'pay-1',
  invoiceId: 'inv-void',
  method: PaymentMethod.BANK_TRANSFER,
  amount: '1000000.00',
  metadata: {},
  ...over,
});
const voided = invoice({
  id: 'inv-void',
  invoiceNo: 'INV-VOID',
  status: InvoiceStatus.VOID,
  startAt: new Date('2027-04-01T00:00:00+07:00'),
  total: 1000000,
});

const input = (over: Partial<SettlementCalcInput> = {}): SettlementCalcInput => ({
  deposit: { amount: '2000000.00', paymentId: 'dep-pay' },
  timing: ON_TIME,
  invoices: [],
  payments: [],
  damages: [],
  ...over,
});
const damage = (index: number, proposedFee: number | null) => ({
  index,
  description: `Hư hỏng ${index}`,
  severity: DamageSeverity.MINOR,
  proposedFee,
});
const outcome = (result: ReturnType<typeof computeSettlement>) => [
  result.totals?.refund_amount,
  result.totals?.shortfall_amount,
];

describe('computeSettlement', () => {
  it('refunds the whole deposit on an on-time return', () => {
    expect(outcome(computeSettlement(input()))).toEqual([2000000, 0]);
  });

  it('deducts one month of rent for an early return without enough notice, unless waived', () => {
    const timing = { ...ON_TIME, early: true, shortNotice: true, shortNoticeDeduction: 1000000 };
    expect(outcome(computeSettlement(input({ timing })))).toEqual([1000000, 0]);

    const waived = computeSettlement(input({ timing }), {
      waivedLines: [{ type: SettlementLineType.EARLY_RETURN_SHORT_NOTICE, reason: '  Hotline  ' }],
    });
    expect(outcome(waived)).toEqual([2000000, 0]);
    expect(waived.lines[0]).toMatchObject({ waived: true, waive_reason: 'Hotline', amount: 0 });
  });

  it('charges each overstay day at the daily rent times the captured percent', () => {
    const timing = returnTiming({
      effectiveAt: new Date('2026-10-01T09:00:00+07:00'),
      months: 3,
      monthlyPrice: '1500000.00',
      noticeFrom: new Date('2026-12-01T09:00:00+07:00'),
      scheduledAt: new Date('2026-12-31T09:00:00+07:00'),
      returnedOn: '2027-01-11',
      rules: { noticeDays: 30, penaltyPercent: 100 },
      goLiveAt: new Date('2026-06-01T00:00:00+07:00'),
    });
    const result = computeSettlement(input({ timing }));
    expect(result.lines[0]).toMatchObject({
      type: SettlementLineType.OVERSTAY,
      quantity: 10,
      unit_amount: 50000,
      amount: 500000,
    });
    expect(outcome(result)).toEqual([1500000, 0]);
  });

  it('charges damages as decided: accepted, waived, or corrected', () => {
    const damages = [damage(0, 300000), damage(1, 100000), damage(2, 500000)];
    const result = computeSettlement(input({ damages }), {
      damageDecisions: [
        { index: 0, amount: 300000 },
        { index: 1, waived: true },
        { index: 2, amount: 250000 },
      ],
    });
    expect(outcome(result)).toEqual([1450000, 0]);
    expect(result.lines.map((l) => [l.amount, l.waived, l.proposed_amount])).toEqual([
      [300000, false, 300000],
      [0, true, 100000],
      [250000, false, 500000],
    ]);
    expect(result.pending).toEqual({ damageIndexes: [], paymentIds: [] });
  });

  it('keeps an undecided damage pending, priced at the proposal (or 0 without one)', () => {
    const result = computeSettlement(input({ damages: [damage(0, 300000), damage(1, null)] }));
    expect(result.pending.damageIndexes).toEqual([0, 1]);
    expect(result.lines.map((l) => [l.amount, l.needs_decision, l.proposed_amount])).toEqual([
      [300000, true, 300000],
      [0, true, null],
    ]);
  });

  it('offsets unpaid rent and credits rent paid for an unused period', () => {
    const result = computeSettlement(
      input({ invoices: [invoice(), voided], payments: [payment()] }),
    );
    expect(result.lines.map((l) => [l.type, l.direction, l.amount])).toEqual([
      [SettlementLineType.UNPAID_INVOICE, 'DEDUCTION', 800000],
      [SettlementLineType.UNUSED_PERIOD_CREDIT, 'CREDIT', 1000000],
    ]);
    expect(outcome(result)).toEqual([2200000, 0]);
  });

  it('treats a period starting on the return day as unused even before it is voided', () => {
    const unstarted = { ...voided, status: InvoiceStatus.PARTIALLY_PAID };
    const result = computeSettlement(input({ invoices: [unstarted], payments: [payment()] }));
    expect(result.lines.map((l) => l.type)).toEqual([SettlementLineType.UNUSED_PERIOD_CREDIT]);
  });

  it('lists debts oldest due first, net of what was already paid', () => {
    const later = invoice({ id: 'inv-b', invoiceNo: 'INV-B', dueAt: new Date('2027-03-05') });
    const earlier = invoice({ id: 'inv-c', invoiceNo: 'INV-C', dueAt: new Date('2027-02-01') });
    const partly = payment({ id: 'p-b', invoiceId: 'inv-b', amount: 300000 });
    const result = computeSettlement(input({ invoices: [later, earlier], payments: [partly] }));
    expect(result.lines.map((l) => [l.invoice_no, l.amount])).toEqual([
      ['INV-C', 800000],
      ['INV-B', 500000],
    ]);
  });

  it('credits a payment under review only when staff include it', () => {
    const review = payment({ amount: 500000, metadata: { needsReview: 'invoice VOID' } });
    const base = input({ invoices: [voided], payments: [review] });

    const undecided = computeSettlement(base);
    expect(undecided.pending.paymentIds).toEqual(['pay-1']);
    expect(undecided.lines[0]).toMatchObject({ included: null, amount: 0, needs_decision: true });

    const exclude = { creditDecisions: [{ paymentId: 'pay-1', include: false }] };
    const include = { creditDecisions: [{ paymentId: 'pay-1', include: true }] };
    expect(outcome(computeSettlement(base, exclude))).toEqual([2000000, 0]);
    expect(outcome(computeSettlement(base, include))).toEqual([2500000, 0]);
  });

  it('bills what the deposit cannot cover', () => {
    const result = computeSettlement(
      input({
        deposit: { amount: 1000000, paymentId: null },
        invoices: [invoice()],
        damages: [damage(0, 700000)],
      }),
      { damageDecisions: [{ index: 0, amount: 700000 }] },
    );
    expect(outcome(result)).toEqual([0, 500000]);
  });

  it('works on a real zero deposit', () => {
    const result = computeSettlement(
      input({ deposit: { amount: 0, paymentId: null }, damages: [damage(0, null)] }),
      { damageDecisions: [{ index: 0, amount: 200000 }] },
    );
    expect(outcome(result)).toEqual([0, 200000]);
  });

  it('gives no totals while the deposit is unknown', () => {
    expect(computeSettlement(input({ deposit: null })).totals).toBeNull();
  });

  it.each([
    ['reconciled by hand', { metadata: { reconciledAt: '2027-04-02' } }],
    ['already used by a settlement', { metadata: { settlementId: 's-1' } }],
    ['itself taken from the deposit', { method: PaymentMethod.DEPOSIT }],
  ])('does not credit a payment %s', (_label, over) => {
    const result = computeSettlement(
      input({ invoices: [voided], payments: [payment(over as Partial<CalcPayment>)] }),
    );
    expect(result.lines).toEqual([]);
  });

  it.each([
    ['a damage that does not exist', { damageDecisions: [{ index: 3, amount: 1 }] }],
    [
      'a damage both waived and priced',
      { damageDecisions: [{ index: 0, amount: 1, waived: true }] },
    ],
    [
      'excluding an automatic credit',
      { creditDecisions: [{ paymentId: 'pay-1', include: false }] },
    ],
    [
      'waiving a line the settlement does not have',
      { waivedLines: [{ type: SettlementLineType.OVERSTAY, reason: 'x' }] },
    ],
  ])('rejects %s', (_label, decisions) => {
    const base = input({ invoices: [voided], payments: [payment()], damages: [damage(0, 1)] });
    expect(() => computeSettlement(base, decisions as never)).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });
});

describe('settledDepositStatus', () => {
  const totals = (deposit: number, credits: number, refund: number) => ({
    deposit_amount: deposit,
    credits_total: credits,
    refund_amount: refund,
  });

  it.each([
    ['the whole deposit refunded', totals(2000000, 0, 2000000), DepositStatus.REFUNDED],
    ['everything deducted', totals(2000000, 0, 0), DepositStatus.FORFEITED],
    [
      'a refund made mostly of credits',
      totals(2000000, 1000000, 1500000),
      DepositStatus.PARTIALLY_REFUNDED,
    ],
    ['a zero deposit', totals(0, 0, 0), DepositStatus.REFUNDED],
  ])('%s', (_label, value, expected) => {
    expect(settledDepositStatus(value)).toBe(expected);
  });
});

describe('settlementVersion', () => {
  const version = (base: SettlementCalcInput, decisions = {}) => {
    const { lines, totals } = computeSettlement(base, decisions);
    return settlementVersion({
      deposit: base.deposit,
      lines,
      totals,
      customerBankAccount: null,
      effectiveReturnDay: base.timing.effectiveReturnDay,
    });
  };

  it('is stable for the same figures, whatever the numeric format of the deposit', () => {
    const a = input({ deposit: { amount: '2000000.00', paymentId: 'p' } });
    const b = input({ deposit: { amount: 2000000, paymentId: 'p' } });
    expect(version(a)).toBe(version(b));
    expect(version(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes with the decisions and with the money', () => {
    const base = input({ damages: [damage(0, 300000)] });
    expect(version(base)).not.toBe(
      version(base, { damageDecisions: [{ index: 0, waived: true }] }),
    );
    expect(version(base)).not.toBe(version(input({ ...base, invoices: [invoice()] })));
  });
});
