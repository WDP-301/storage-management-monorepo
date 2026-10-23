import type { Invoice } from '@entities/invoice.entity';
import type { Payment } from '@entities/payment.entity';
import { startOfVietnamDay } from '@shared/utils/calendar.util';
import type {
  ContractInvoiceRecord,
  EvidenceFile,
  InvoicePaymentRecord,
  PaymentMethod,
} from '@storage/types';
import Decimal from 'decimal.js';
import { PAYABLE_INVOICE_STATUSES } from './first-rent.util';

/**
 * Keys a hand-recorded payment keeps in `payments.metadata`. `confirmedBy` is shared with the
 * first-month cash confirmation, so those payments read as manual too.
 */
export interface ManualPaymentMetadata {
  confirmedBy: string;
  note?: string;
  transferRef?: string;
  evidence?: EvidenceFile[];
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

export function toInvoicePaymentRecord(
  payment: Payment,
  userNames: ReadonlyMap<string, string | null>,
): InvoicePaymentRecord {
  const metadata = payment.metadata ?? {};
  const recordedBy = text(metadata.confirmedBy);
  const needsReview = text(metadata.needsReview);
  return {
    id: payment.id,
    payment_no: payment.paymentNo,
    method: payment.method as PaymentMethod,
    amount: Number(payment.amount),
    paid_at: payment.paidAt ?? null,
    is_manual: recordedBy !== null,
    // Bank reference staff can match against the statement; SePay's own id only as a fallback.
    transfer_ref:
      text(metadata.transferRef) ?? text(metadata.referenceCode) ?? payment.providerRef ?? null,
    evidence: Array.isArray(metadata.evidence) ? (metadata.evidence as EvidenceFile[]) : [],
    // A transfer that landed on an already settled invoice is kept for hand reconciliation.
    note: text(metadata.note) ?? (needsReview ? `Cần đối soát: hóa đơn ${needsReview}` : null),
    recorded_by: recordedBy
      ? { id: recordedBy, full_name: userNames.get(recordedBy) ?? null }
      : null,
  };
}

export function toContractInvoiceRecord(
  invoice: Invoice,
  payments: InvoicePaymentRecord[],
  now: Date,
): ContractInvoiceRecord {
  const paid = payments.reduce((sum, payment) => sum.plus(payment.amount), new Decimal(0));
  const payable = PAYABLE_INVOICE_STATUSES.includes(invoice.status);
  const due = Decimal.max(new Decimal(invoice.total).minus(paid), 0);
  return {
    id: invoice.id,
    invoice_no: invoice.invoiceNo,
    kind: invoice.kind,
    period_no: invoice.periodNo,
    status: invoice.status,
    start_at: invoice.startAt ?? null,
    end_at: invoice.endAt ?? null,
    due_at: invoice.dueAt ?? null,
    issued_at: invoice.issuedAt ?? null,
    total: Number(invoice.total),
    paid_amount: paid.toNumber(),
    // Rounded up to whole VND — the most a hand-recorded payment may take.
    amount_due: payable ? due.ceil().toNumber() : 0,
    // Due dates are shown as Vietnam calendar days; an invoice turns overdue the day after.
    is_overdue: payable && !!invoice.dueAt && invoice.dueAt < startOfVietnamDay(now),
    payments,
  };
}
