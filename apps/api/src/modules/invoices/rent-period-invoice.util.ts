import type { Contract } from '@entities/contract.entity';
import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import type { NotificationsService } from '@modules/notifications/notifications.service';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import { generateInvoiceNo } from '@modules/payments/invoice-no.util';
import type { QueueService } from '@modules/queue/queue.service';
import { readNumberSetting } from '@modules/settings/setting-read.util';
import { addVietnamCalendarMonths } from '@shared/utils/calendar.util';
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
import { rentInvoiceAmounts } from './rent-invoice-amounts.util';

/** Period 1 of the INITIAL contract is the first month's rent, collected at handover. */
const FIRST_MONTH_PERIOD_NO = 1;

const DAY_MS = 86_400_000;

/** A rent period falls due when it starts, plus the configured grace days (Vietnam has no DST). */
export const rentDueAt = (startAt: Date, graceDays: number): Date =>
  new Date(startAt.getTime() + graceDays * DAY_MS);

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
    const startAt = addVietnamCalendarMonths(contract.effectiveAt, periodNo - 1);
    const endAt = addVietnamCalendarMonths(contract.effectiveAt, periodNo);
    periods.push({ periodNo, startAt, endAt });
  }
  return periods;
}

/**
 * Tells the customer an invoice is ready to pay. `contractId` lets the app open the contract,
 * where the invoice and its transfer QR are shown. The first month is paid at handover, right
 * away, so it says so instead of naming a due date.
 */
export function invoiceIssuedNotification(invoice: Invoice): NotificationPayload {
  const isFirstMonth =
    invoice.kind === RentalPeriodKind.INITIAL && invoice.periodNo === FIRST_MONTH_PERIOD_NO;
  return {
    type: NotificationType.INVOICE_ISSUED,
    title: isFirstMonth
      ? 'Thanh toán tiền thuê tháng đầu'
      : `Hóa đơn tiền thuê kho kỳ ${invoice.periodNo}`,
    body: isFirstMonth
      ? `Hóa đơn ${invoice.invoiceNo} với số tiền ${formatVndCurrency(invoice.total)} đã được phát hành. Mở hợp đồng trong ứng dụng để quét mã QR thanh toán và nhận kho.`
      : `Hóa đơn ${invoice.invoiceNo} với số tiền ${formatVndCurrency(invoice.total)} đã được phát hành. Hạn thanh toán đến ${formatDateStr(invoice.dueAt)}. Vui lòng thanh toán đúng hạn.`,
    data: {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      contractId: invoice.contractId ?? null,
      total: invoice.total,
      dueAt: invoice.dueAt ? invoice.dueAt.toISOString() : null,
    },
  };
}

/**
 * Issues the rent invoice of one period on the caller's transaction, unless a live one exists
 * (a settlement invoice never counts as the period): one month at the contract price plus VAT,
 * due when the period starts plus the grace days, with its rent line, and the customer is
 * notified. The caller makes sure the contract is ACTIVE and holds a lock on its row, which
 * serializes issuers of the same contract;
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
  const [amounts, graceDays] = await Promise.all([
    rentInvoiceAmounts(em, monthlyPrice),
    readNumberSetting(em, 'billing.rent_grace_days'),
  ]);
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
      ...amounts,
      issuedAt: now,
      dueAt: rentDueAt(startAt, graceDays),
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
