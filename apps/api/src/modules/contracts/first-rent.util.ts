import { Invoice } from '@entities/invoice.entity';
import { Payment } from '@entities/payment.entity';
import { buildPaymentQrUrl } from '@modules/payments/vietqr.util';
import type { ConfigService } from '@nestjs/config';
import { InvoiceStatus, PaymentMethod, PaymentStatus, RentalPeriodKind } from '@storage/types';
import Decimal from 'decimal.js';
import { type DataSource, type EntityManager, In, Not } from 'typeorm';

/** The first month's rent is period 1 of the INITIAL contract; it must be paid before handover. */
export const FIRST_RENT_PERIOD_NO = 1;

export const FIRST_RENT_UNPAID_MESSAGE =
  'Khách chưa thanh toán tiền thuê tháng đầu — thu tiền trước khi chốt biên nhận.';

/** Invoice statuses that still accept money. */
export const PAYABLE_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.ISSUED,
  InvoiceStatus.PARTIALLY_PAID,
];

/** First-month rent of a contract, as shown to staff and managers. */
export interface FirstRentSummary {
  invoice_id: string;
  invoice_no: string;
  status: InvoiceStatus;
  total: number;
  paid_amount: number;
  amount_due: number;
  /** When the invoice was settled; null until PAID. */
  paid_at: string | Date | null;
  /** How the last payment arrived; null before any payment. */
  method: PaymentMethod | null;
  /** Transfer QR for the amount still due — staff view only, null once nothing is due. */
  payment_qr_url: string | null;
}

/** The live (non-VOID) first-month invoice of a contract. */
export function findFirstRentInvoice(
  em: EntityManager,
  contractId: string,
  options: { lock?: boolean } = {},
): Promise<Invoice | null> {
  return em.findOne(Invoice, {
    where: {
      contractId,
      kind: RentalPeriodKind.INITIAL,
      periodNo: FIRST_RENT_PERIOD_NO,
      status: Not(InvoiceStatus.VOID),
    },
    ...(options.lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
  });
}

/** Sum of the invoice's settled payments. */
export async function sumInvoicePayments(em: EntityManager, invoiceId: string): Promise<Decimal> {
  const sum = await em
    .getRepository(Payment)
    .sum('amount', { invoiceId, status: PaymentStatus.SUCCEEDED });
  return new Decimal(sum ?? 0);
}

/** Adds the transfer QR for what is still due; only offered while the invoice accepts money. */
export function withPaymentQr(summary: FirstRentSummary, config: ConfigService): FirstRentSummary {
  if (!PAYABLE_INVOICE_STATUSES.includes(summary.status) || summary.amount_due <= 0) {
    return summary;
  }
  return {
    ...summary,
    payment_qr_url: buildPaymentQrUrl(config, summary.amount_due, summary.invoice_no),
  };
}

/** First-month rent summaries keyed by contract id; contracts without an invoice are absent. */
export async function loadFirstRentSummaries(
  dataSource: DataSource | EntityManager,
  contractIds: string[],
): Promise<Map<string, FirstRentSummary>> {
  const byContract = new Map<string, FirstRentSummary>();
  if (contractIds.length === 0) return byContract;
  const invoices = await dataSource.getRepository(Invoice).find({
    where: {
      contractId: In(contractIds),
      kind: RentalPeriodKind.INITIAL,
      periodNo: FIRST_RENT_PERIOD_NO,
      status: Not(InvoiceStatus.VOID),
    },
  });
  if (invoices.length === 0) return byContract;
  const payments = await dataSource.getRepository(Payment).find({
    where: { invoiceId: In(invoices.map((i) => i.id)), status: PaymentStatus.SUCCEEDED },
    order: { paidAt: 'ASC', createdAt: 'ASC' },
  });
  for (const invoice of invoices) {
    const own = payments.filter((p) => p.invoiceId === invoice.id);
    const paid = own.reduce((sum, p) => sum.plus(p.amount), new Decimal(0));
    const total = new Decimal(invoice.total);
    const last = own.at(-1);
    byContract.set(invoice.contractId as string, {
      invoice_id: invoice.id,
      invoice_no: invoice.invoiceNo,
      status: invoice.status,
      total: total.toNumber(),
      paid_amount: paid.toNumber(),
      amount_due: Decimal.max(total.minus(paid), 0).toNumber(),
      paid_at:
        invoice.status === InvoiceStatus.PAID ? (last?.paidAt ?? invoice.issuedAt ?? null) : null,
      method: last?.method ?? null,
      payment_qr_url: null,
    });
  }
  return byContract;
}
