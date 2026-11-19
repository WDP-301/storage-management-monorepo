import { formatVndCurrency } from '@modules/invoices/invoice-pdf.service';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import { formatVietnamDate, vietnamDate, vietnamDayIndex } from '@shared/utils/calendar.util';
import { NotificationType } from '@storage/types';

/** When overdue reminders go out, in days overdue; mirrors the `billing.overdue_*` settings. */
export interface OverdueReminderSchedule {
  /** Days the customer is reminded on; after the last one, every `repeatDays`. */
  customerDays: number[];
  repeatDays: number;
  /** From this day the branch's managers are told as well, then every `repeatDays`. */
  managerFromDays: number;
}

/** An unpaid invoice past its due day, with what is still owed on it. */
export interface OverdueInvoice {
  invoiceId: string;
  invoiceNo: string;
  customerId: string;
  customerName: string;
  contractId: string | null;
  contractNo: string | null;
  unitCode: string | null;
  facilityId: string | null;
  dueAt: Date;
  amountDue: number;
}

/**
 * Whole Vietnam days since the due day: 1 on the first day the invoice counts as overdue (the
 * day after its due day, as everywhere else), 0 or less while it is not overdue yet.
 */
export function daysOverdue(dueAt: Date, now: Date): number {
  return vietnamDayIndex(vietnamDate(now)) - vietnamDayIndex(vietnamDate(dueAt));
}

/** `days` is `from` or a whole number of `every` steps after it. */
const isRepeatDay = (days: number, from: number, every: number): boolean =>
  days >= from && (days - from) % Math.max(every, 1) === 0;

/** The customer is reminded on each listed day, then every `repeatDays` after the last one. */
export function isCustomerReminderDay(days: number, schedule: OverdueReminderSchedule): boolean {
  if (days < 1) return false;
  if (schedule.customerDays.includes(days)) return true;
  const last = Math.max(0, ...schedule.customerDays);
  return last > 0 && days > last && isRepeatDay(days, last, schedule.repeatDays);
}

/** The managers are told from `managerFromDays` overdue, then every `repeatDays`. */
export function isManagerAlertDay(days: number, schedule: OverdueReminderSchedule): boolean {
  return isRepeatDay(days, Math.max(schedule.managerFromDays, 1), schedule.repeatDays);
}

function data(invoice: OverdueInvoice, days: number): Record<string, unknown> {
  return {
    invoiceId: invoice.invoiceId,
    invoiceNo: invoice.invoiceNo,
    contractId: invoice.contractId,
    contractNo: invoice.contractNo,
    customerId: invoice.customerId,
    daysOverdue: days,
    amountDue: invoice.amountDue,
  };
}

export function customerOverdueNotification(
  invoice: OverdueInvoice,
  days: number,
): NotificationPayload {
  const unit = invoice.unitCode ? ` (kho ${invoice.unitCode})` : '';
  return {
    type: NotificationType.INVOICE_OVERDUE,
    title: `Hóa đơn ${invoice.invoiceNo} quá hạn ${days} ngày`,
    body:
      `Hóa đơn ${invoice.invoiceNo}${unit} còn ${formatVndCurrency(invoice.amountDue)} chưa ` +
      `thanh toán, hạn ngày ${formatVietnamDate(invoice.dueAt)}. Hóa đơn quá hạn tạm chặn đặt ` +
      'thuê mới, đổi kho và gửi/lấy đồ trên kệ — vui lòng thanh toán sớm trong ứng dụng.',
    data: data(invoice, days),
  };
}

export function managerOverdueAlert(invoice: OverdueInvoice, days: number): NotificationPayload {
  const unit = invoice.unitCode ? ` (kho ${invoice.unitCode})` : '';
  return {
    type: NotificationType.INVOICE_OVERDUE_ALERT,
    title: `Khách nợ quá hạn ${days} ngày`,
    body:
      `${invoice.customerName} chưa thanh toán hóa đơn ${invoice.invoiceNo}${unit}, còn ` +
      `${formatVndCurrency(invoice.amountDue)} quá hạn ${days} ngày. Liên hệ khách để thu.`,
    data: data(invoice, days),
  };
}
