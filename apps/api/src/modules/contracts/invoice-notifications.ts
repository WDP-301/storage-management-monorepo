import type { Invoice } from '@entities/invoice.entity';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import { NotificationType } from '@storage/types';

/** Sent to the customer once an invoice is fully paid, whichever way the money arrived. */
export function invoicePaidNotification(
  invoice: Invoice,
  amount: number | string,
): NotificationPayload {
  return {
    type: NotificationType.INVOICE_PAID,
    title: 'Thanh toán hóa đơn thành công',
    body: `Hóa đơn ${invoice.invoiceNo} đã được thanh toán thành công số tiền ${Number(amount).toLocaleString('vi-VN')} VND. Cảm ơn Quý khách!`,
    data: {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      amount,
    },
  };
}
