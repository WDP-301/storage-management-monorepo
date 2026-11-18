import type { Booking } from '@entities/booking.entity';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import { NotificationType } from '@storage/types';

const vnd = (amount: number | string): string => `${Number(amount).toLocaleString('vi-VN')} VND`;

/**
 * The hold ran out before the deposit arrived. The customer only ever sees the status change —
 * without this they can sit on a QR they can no longer use.
 */
export function bookingExpiredNotification(booking: Booking): NotificationPayload {
  return {
    type: NotificationType.BOOKING_EXPIRED,
    title: 'Chỗ giữ đã hết hạn',
    body:
      `Booking ${booking.bookingNo} đã hết thời gian giữ chỗ mà chưa nhận đủ tiền cọc — ` +
      'các kho đã được nhả ra. Đặt lại nếu bạn vẫn cần kho.',
    data: { bookingId: booking.id, bookingNo: booking.bookingNo },
  };
}

/**
 * To the managers of the booking's facilities: the customer paid toward a booking that then
 * died (cancelled or expired). Nothing refunds it automatically — a human must send it back.
 */
export function bookingNeedsRefundNotification(
  booking: Booking,
  paidAmount: string,
  cause: 'CANCELLED' | 'EXPIRED',
): NotificationPayload {
  return {
    type: NotificationType.BOOKING_NEEDS_REFUND,
    title: 'Booking có tiền đã bị hủy — cần hoàn tiền',
    body:
      `Booking ${booking.bookingNo} ${cause === 'EXPIRED' ? 'hết hạn' : 'bị khách hủy'} ` +
      `sau khi đã nhận ${vnd(paidAmount)}. Đối soát các giao dịch liên quan (đã đưa về cần xử lý) ` +
      'và hoàn tiền cho khách.',
    data: {
      bookingId: booking.id,
      bookingNo: booking.bookingNo,
      paidAmount,
      cause,
    },
  };
}

/**
 * The customer transferred toward the deposit but it was not enough: the booking still waits for
 * the rest and can expire if the hold runs out. Telling them the exact shortfall is what makes a
 * top-up arrive with the same booking number in the content.
 */
export function depositPartialNotification(
  booking: Booking,
  received: number | string,
  remaining: number | string,
): NotificationPayload {
  return {
    type: NotificationType.BOOKING_DEPOSIT_PARTIAL,
    title: 'Đặt cọc chưa đủ',
    body:
      `Chỗ giữ ${booking.bookingNo} đã nhận ${vnd(received)} — còn thiếu ${vnd(remaining)} để xác nhận. ` +
      `Vui lòng chuyển khoản bổ sung kèm mã ${booking.bookingNo} trong nội dung trước khi hết hạn giữ chỗ.`,
    data: {
      bookingId: booking.id,
      bookingNo: booking.bookingNo,
      received,
      remaining,
    },
  };
}
