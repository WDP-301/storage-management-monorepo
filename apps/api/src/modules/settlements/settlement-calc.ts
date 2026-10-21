import { fromVietnamDate } from '@shared/utils/calendar.util';
import {
  type DamageSeverity,
  type InvoiceKind,
  InvoiceStatus,
  PaymentMethod,
  type SettlementDecisionsInput,
  type SettlementLine,
  SettlementLineType,
  type SettlementTotals,
} from '@storage/types';
import Decimal from 'decimal.js';
import type { ReturnTiming } from './return-timing';
import { indexDecisions } from './settlement-decisions.util';
import { settlementTotals } from './settlement-totals';

export interface CalcInvoice {
  id: string;
  invoiceNo: string;
  kind: InvoiceKind;
  status: InvoiceStatus;
  /** Null for the first month's invoice, which always counts as started. */
  startAt: Date | null;
  dueAt: Date | null;
  total: Decimal.Value;
}

export interface CalcPayment {
  id: string;
  invoiceId: string;
  method: PaymentMethod;
  amount: Decimal.Value;
  metadata: Record<string, unknown> | null;
}

export interface CalcDamage {
  index: number;
  description: string;
  severity: DamageSeverity | null;
  proposedFee: number | null;
}

export interface SettlementCalcInput {
  /** Deposit still held; null when it cannot be determined. */
  deposit: { amount: Decimal.Value; paymentId: string | null } | null;
  timing: ReturnTiming;
  /** Rent invoices of the contract (never settlement invoices). */
  invoices: CalcInvoice[];
  /** Succeeded payments on those invoices. */
  payments: CalcPayment[];
  damages: CalcDamage[];
}

export interface SettlementComputation {
  lines: SettlementLine[];
  totals: SettlementTotals | null;
  /** What still waits for a decision before the settlement can be approved. */
  pending: { damageIndexes: number[]; paymentIds: string[] };
}

const PAYABLE: InvoiceStatus[] = [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID];
const num = (value: Decimal.Value): number => new Decimal(value).toNumber();
const time = (at: Date | null): number => (at ? at.getTime() : 0);

const line = (fields: Partial<SettlementLine> & Pick<SettlementLine, 'type'>): SettlementLine => ({
  direction: 'DEDUCTION',
  description: '',
  quantity: 1,
  unit_amount: 0,
  amount: 0,
  waived: false,
  waive_reason: null,
  needs_decision: false,
  ...fields,
});

/**
 * The settlement lines and totals of a returned contract. Rent periods starting before the
 * effective return day E are owed; periods from E on are unused whatever their status (finalize
 * voids them, a late void changes nothing here). Money paid on unused periods is credited back,
 * unless it was already reconciled or used by a settlement; money flagged for review is credited
 * only when staff include it. Deposit null → no totals (it must be recorded first).
 */
export function computeSettlement(
  input: SettlementCalcInput,
  decisions: SettlementDecisionsInput = {},
): SettlementComputation {
  const { timing } = input;
  const startOfE = fromVietnamDate(timing.effectiveReturnDay).getTime();
  const started = (invoice: CalcInvoice) => !invoice.startAt || time(invoice.startAt) < startOfE;
  const invoiceById = new Map(input.invoices.map((invoice) => [invoice.id, invoice]));
  const paid = new Map<string, Decimal>();
  for (const p of input.payments) {
    paid.set(p.invoiceId, (paid.get(p.invoiceId) ?? new Decimal(0)).plus(p.amount));
  }

  const credits: { payment: CalcPayment; invoice: CalcInvoice; review: boolean }[] = [];
  for (const payment of input.payments) {
    const invoice = invoiceById.get(payment.invoiceId);
    const meta = payment.metadata ?? {};
    if (!invoice || payment.method === PaymentMethod.DEPOSIT) continue;
    if (meta.reconciledAt || meta.settlementId) continue;
    if (invoice.status !== InvoiceStatus.VOID && started(invoice)) continue;
    credits.push({ payment, invoice, review: Boolean(meta.needsReview) });
  }
  const decided = indexDecisions(decisions, {
    damageIndexes: input.damages.map((d) => d.index),
    reviewPaymentIds: credits.filter((c) => c.review).map((c) => c.payment.id),
    creditPaymentIds: credits.filter((c) => !c.review).map((c) => c.payment.id),
    waivableTypes: [
      ...(timing.shortNotice ? [SettlementLineType.EARLY_RETURN_SHORT_NOTICE] : []),
      ...(timing.overstayDays > 0 ? [SettlementLineType.OVERSTAY] : []),
    ],
  });

  const lines: SettlementLine[] = [];
  const unpaid = input.invoices
    .filter((invoice) => PAYABLE.includes(invoice.status) && started(invoice))
    .sort((a, b) => time(a.dueAt) - time(b.dueAt) || a.id.localeCompare(b.id));
  for (const invoice of unpaid) {
    const outstanding = new Decimal(invoice.total).minus(paid.get(invoice.id) ?? 0);
    if (outstanding.lte(0)) continue;
    lines.push(
      line({
        type: SettlementLineType.UNPAID_INVOICE,
        description: `Tiền thuê còn nợ — hoá đơn ${invoice.invoiceNo}`,
        unit_amount: outstanding.toNumber(),
        amount: outstanding.toNumber(),
        invoice_id: invoice.id,
        invoice_no: invoice.invoiceNo,
      }),
    );
  }

  const waivable = (type: SettlementLineType, quantity: number, unit: number, text: string) => {
    const reason = decided.waived.get(type) ?? null;
    lines.push(
      line({
        type,
        description: text,
        quantity,
        unit_amount: unit,
        amount: reason ? 0 : num(new Decimal(unit).mul(quantity)),
        waived: reason !== null,
        waive_reason: reason,
      }),
    );
  };
  if (timing.shortNotice) {
    waivable(
      SettlementLineType.EARLY_RETURN_SHORT_NOTICE,
      1,
      timing.shortNoticeDeduction,
      `Trả kho sớm, báo trước ${timing.noticeDays}/${timing.requiredNoticeDays} ngày — trừ 1 tháng thuê`,
    );
  }
  if (timing.overstayDays > 0) {
    waivable(
      SettlementLineType.OVERSTAY,
      timing.overstayDays,
      timing.overstayPenaltyPerDay,
      `Quá hạn trả kho ${timing.overstayDays} ngày`,
    );
  }

  for (const damage of input.damages) {
    const decision = decided.damages.get(damage.index);
    const amount = decision?.waived ? 0 : (decision?.amount ?? damage.proposedFee ?? 0);
    lines.push(
      line({
        type: SettlementLineType.DAMAGE,
        description: `Hư hỏng: ${damage.description}`,
        unit_amount: decision?.waived ? (damage.proposedFee ?? 0) : amount,
        amount,
        waived: Boolean(decision?.waived),
        needs_decision: !decision,
        damage_index: damage.index,
        severity: damage.severity,
        proposed_amount: damage.proposedFee,
      }),
    );
  }

  for (const { payment, invoice, review } of credits) {
    const included = review ? (decided.credits.get(payment.id) ?? null) : true;
    const amount = num(payment.amount);
    lines.push(
      line({
        type: review
          ? SettlementLineType.REVIEW_PAYMENT_CREDIT
          : SettlementLineType.UNUSED_PERIOD_CREDIT,
        direction: 'CREDIT',
        description: review
          ? `Khoản tiền cần kiểm tra — hoá đơn ${invoice.invoiceNo}`
          : `Hoàn tiền thuê kỳ không dùng — hoá đơn ${invoice.invoiceNo}`,
        unit_amount: amount,
        amount: included ? amount : 0,
        needs_decision: included === null,
        invoice_id: invoice.id,
        invoice_no: invoice.invoiceNo,
        payment_id: payment.id,
        ...(review ? { included } : {}),
      }),
    );
  }

  return {
    lines,
    totals: input.deposit ? settlementTotals(input.deposit.amount, lines) : null,
    pending: {
      damageIndexes: lines
        .filter((l) => l.type === SettlementLineType.DAMAGE && l.needs_decision)
        .map((l) => l.damage_index as number),
      paymentIds: lines
        .filter((l) => l.type === SettlementLineType.REVIEW_PAYMENT_CREDIT && l.needs_decision)
        .map((l) => l.payment_id as string),
    },
  };
}
