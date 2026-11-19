import { formatVndCurrency } from '@modules/invoices/invoice-pdf.service';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import { formatVietnamDate, vietnamDate, vietnamDayIndex } from '@shared/utils/calendar.util';
import { NotificationType } from '@storage/types';

/** From this many days overdue the branch's managers are told as well, weekly. */
export const MANAGER_ALERT_FROM_DAYS = 7;

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

/** The customer is reminded on days 1, 3 and 7 overdue, then every 7 days. */
export function isCustomerReminderDay(days: number): boolean {
  return days === 1 || days === 3 || (days >= 7 && days % 7 === 0);
}

/** The managers are told from day 7 overdue, then every 7 days. */
export function isManagerAlertDay(days: number): boolean {
  return days >= MANAGER_ALERT_FROM_DAYS && days % 7 === 0;
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
