import type { NotificationPayload } from '@modules/notifications/types/notification';
import { NotificationType, ShelfReceiptType, type ShelfReceiptView } from '@storage/types';
import { linesSummary } from './shelf-rules';

const receiptData = (receipt: ShelfReceiptView) => ({
  contractId: receipt.contractId,
  receiptId: receipt.id,
  receiptCode: receipt.code,
});

/** Tells the customer a receipt took effect: a drop-off, a pick-up, or a manager's recovery. */
export function receiptNotice(receipt: ShelfReceiptView): NotificationPayload {
  const summary = linesSummary(receipt.lines);
  if (receipt.type === ShelfReceiptType.DROP_OFF) {
    return {
      type: NotificationType.SHELF_DROP_OFF,
      title: 'Đã nhận đồ gửi',
      body: `Phiếu ${receipt.code} · kệ ${receipt.shelf.code}: ${summary}`,
      data: receiptData(receipt),
    };
  }
  if (receipt.recovered) {
    return {
      type: NotificationType.SHELF_PICK_UP,
      title: 'Đã thu hồi đồ trên kệ',
      body: `Kệ ${receipt.shelf.code} được trả theo yêu cầu thu hồi; phiếu ${receipt.code}: ${summary}`,
      data: receiptData(receipt),
    };
  }
  return {
    type: NotificationType.SHELF_PICK_UP,
    title: 'Đã trả đồ',
    body: `Phiếu ${receipt.code} · kệ ${receipt.shelf.code}: ${summary}`,
    data: receiptData(receipt),
  };
}

/** Tells the customer a receipt was voided and why. */
export function voidedNotice(receipt: ShelfReceiptView, reason: string): NotificationPayload {
  return {
    type: NotificationType.SHELF_RECEIPT_VOIDED,
    title: 'Phiếu đã bị hủy',
    body: `Phiếu ${receipt.code} đã bị hủy: ${reason}. Số đồ trên kệ đã được cập nhật lại.`,
    data: receiptData(receipt),
  };
}
