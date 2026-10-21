import type { Contract } from '@entities/contract.entity';
import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import type { NotificationsService } from '@modules/notifications/notifications.service';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import { generateInvoiceNo } from '@modules/payments/invoice-no.util';
import type { QueueService } from '@modules/queue/queue.service';
import {
  InvoiceItemType,
  InvoiceKind,
  InvoiceStatus,
  NotificationType,
  RentalPeriodKind,
} from '@storage/types';
import Decimal from 'decimal.js';
import { type EntityManager, Not } from 'typeorm';
import { formatDateStr, formatVndCurrency } from './invoice-pdf.service';

export interface RentPeriod {
  periodNo: number;
  startAt: Date;
  endAt: Date;
}

/** The unit named on the invoice line. */
export interface RentPeriodUnit {
  id?: string | null;
  code?: string | null;
}

type BilledContract = Pick<
  Contract,
  'id' | 'contractNo' | 'customerId' | 'kind' | 'effectiveAt' | 'months' | 'monthlyPriceSnapshot'
>;

/**
 * Rent periods billed one invoice at a time, oldest first: periods 2..months, each one calendar
 * month from `effectiveAt`. Period 1 is the first month's rent, collected at handover. None for a
 * one-month contract, a contract without a start, or a free one.
 */
export function recurringRentPeriods(
  contract: Pick<Contract, 'effectiveAt' | 'months' | 'monthlyPriceSnapshot'>,
): RentPeriod[] {
  if (!contract.effectiveAt || !(contract.months > 1)) return [];
  if (new Decimal(contract.monthlyPriceSnapshot ?? 0).lte(0)) return [];
  const periods: RentPeriod[] = [];
  for (let periodNo = 2; periodNo <= contract.months; periodNo++) {
    const startAt = new Date(contract.effectiveAt);
    startAt.setMonth(startAt.getMonth() + (periodNo - 1));
    const endAt = new Date(contract.effectiveAt);
    endAt.setMonth(endAt.getMonth() + periodNo);
    periods.push({ periodNo, startAt, endAt });
  }
  return periods;
}

export function invoiceIssuedNotification(invoice: Invoice): NotificationPayload {
  return {
    type: NotificationType.INVOICE_ISSUED,
    title: `Hóa đơn tiền thuê kho kỳ ${invoice.periodNo}`,
    body: `Hóa đơn ${invoice.invoiceNo} với số tiền ${formatVndCurrency(invoice.total)} đã được phát hành. Hạn thanh toán đến ${formatDateStr(invoice.dueAt)}. Vui lòng thanh toán đúng hạn.`,
    data: {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      total: invoice.total,
      dueAt: invoice.dueAt ? invoice.dueAt.toISOString() : null,
    },
  };
}

/**
 * Issues the rent invoice of one period on the caller's transaction, unless a live one exists
 * (a settlement invoice never counts as the period): one month at the contract price, due when
 * the period starts, with its rent line, and the customer is notified. The caller makes sure the
 * contract is ACTIVE and holds a lock on its row, which serializes issuers of the same contract;
 * the partial unique index on (contract_id, period_no) is the last guard.
 */
export async function issueRentPeriodInvoice(
  em: EntityManager,
  contract: BilledContract,
  unit: RentPeriodUnit | null | undefined,
  period: RentPeriod,
  now: Date,
  notifications: NotificationsService,
): Promise<Invoice | null> {
  const { periodNo, startAt, endAt } = period;
  const existing = await em.findOne(Invoice, {
    where: {
      contractId: contract.id,
      periodNo,
      status: Not(InvoiceStatus.VOID),
      kind: Not(InvoiceKind.SETTLEMENT),
    },
  });
  if (existing) return null;

  const monthlyPrice = new Decimal(contract.monthlyPriceSnapshot).toNumber();
  const saved = await em.save(
    Invoice,
    em.create(Invoice, {
      invoiceNo: generateInvoiceNo(),
      customerId: contract.customerId,
      contractId: contract.id,
      periodNo,
      kind: contract.kind ?? RentalPeriodKind.INITIAL,
      startAt,
      endAt,
      months: 1,
      monthlyPriceSnapshot: monthlyPrice,
      status: InvoiceStatus.ISSUED,
      currency: 'VND',
      subtotal: monthlyPrice,
      taxAmount: 0,
      total: monthlyPrice,
      issuedAt: now,
      dueAt: startAt,
      billingInfo: {},
    }),
  );
  await em.save(
    InvoiceItem,
    em.create(InvoiceItem, {
      invoiceId: saved.id,
      storageUnitId: unit?.id ?? undefined,
      itemType: InvoiceItemType.RENT,
      description:
        `Tiền thuê kỳ ${periodNo} — Kho ${unit?.code ?? ''} (HĐ: ${contract.contractNo})`.trim(),
      quantity: 1,
      unitAmount: monthlyPrice,
      amount: monthlyPrice,
    }),
  );
  await notifications.createForUsers(em, [saved.customerId], invoiceIssuedNotification(saved));
  return saved;
}

/** Queues the PDF of an issued invoice; call once its transaction has committed. */
export function queueInvoicePdf(queue: QueueService, invoiceId: string): Promise<string | null> {
  return queue.send('invoice.render-pdf', { invoiceId });
}
