import type { Booking } from '@entities/booking.entity';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import { NotificationType } from '@storage/types';

const vnd = (amount: number | string): string => `${Number(amount).toLocaleString('vi-VN')} VND`;

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
