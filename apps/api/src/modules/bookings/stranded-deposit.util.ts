import { Booking } from '@entities/booking.entity';
import type { Payment } from '@entities/payment.entity';
import { BookingStatus, PaymentType } from '@storage/types';
import type { EntityManager } from 'typeorm';

/** Bookings that will never take their deposit: money left on them may move to another booking. */
const DEAD_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.EXPIRED,
  BookingStatus.CANCELLED,
];

/**
 * Why a recorded transfer cannot be moved to another booking, or null when it can. Only a deposit
 * stranded on a booking that died (hold expired, cancelled) moves — never money that is still
 * feeding a live booking or that paid an invoice.
 */
export async function strandedDepositBlocker(
  em: EntityManager,
  payment: Pick<Payment, 'bookingId' | 'invoiceId' | 'type'>,
): Promise<string | null> {
  if (payment.invoiceId || payment.type !== PaymentType.DEPOSIT || !payment.bookingId) {
    return 'Giao dịch đã được ghi nhận cho một khoản thanh toán khác';
  }
  const source = await em.findOne(Booking, { where: { id: payment.bookingId } });
  if (source && !DEAD_BOOKING_STATUSES.includes(source.status)) {
    return `Giao dịch đã được ghi nhận cho booking ${source.bookingNo} (${source.status})`;
  }
  return null;
}
