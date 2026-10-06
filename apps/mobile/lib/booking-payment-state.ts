import { BookingStatus } from '@storage/types';
import type { ApiBooking } from '../src/types/booking-api';
import { holdDeadline } from './booking-hold-state';

/**
 * Deposit payment rules, kept beside the hold rules so the payment screen, the booking list and the
 * polling hook all agree on when a transfer is still possible.
 *
 * The API confirms bookings out-of-band: the customer transfers money, SePay calls the webhook, and
 * only then does the booking become CONFIRMED. Nothing the app does moves that forward, so every
 * state here is derived from a freshly fetched booking rather than from a local action.
 */

/** Mirrors STATUSES_AWAITING_DEPOSIT in the API's bookings service. */
const AWAITING_DEPOSIT: BookingStatus[] = [BookingStatus.HOLDING, BookingStatus.PENDING_DEPOSIT];

export type DepositStage =
  /** Transfer is possible right now and the QR is renderable. */
  | 'awaiting'
  /** Webhook matched the transfer and confirmed the booking. */
  | 'paid'
  /** Hold lapsed or the booking left the deposit flow — transferring now needs manual reconciliation. */
  | 'closed'
  /** Still payable in principle, but the API has no bank account configured so there is no QR. */
  | 'unavailable';

/**
 * Same condition the API uses to decide whether to emit `paymentQrUrl`, re-derived locally so the
 * countdown can close the window between two polls instead of waiting for the next response.
 */
function isDepositWindowOpen(booking: ApiBooking, now: number): boolean {
  return (
    AWAITING_DEPOSIT.includes(booking.status) &&
    booking.expiresAt !== null &&
    holdDeadline(booking) > now
  );
}

export function depositStage(booking: ApiBooking, now: number): DepositStage {
  if (booking.status === BookingStatus.CONFIRMED) return 'paid';
  if (!isDepositWindowOpen(booking, now)) return 'closed';
  return booking.paymentQrUrl ? 'awaiting' : 'unavailable';
}

/**
 * Whether to keep polling. Only `awaiting` and `unavailable` can still change on their own: a
 * webhook may land at any moment, and an operator fixing the bank config makes a QR appear.
 */
export function shouldPollDeposit(stage: DepositStage): boolean {
  return stage === 'awaiting' || stage === 'unavailable';
}

/**
 * Bookings the customer can still pay for, soonest deadline first — drives the "pay now" shortcut
 * on the booking list.
 */
export function selectPayableBookings(bookings: ApiBooking[], now: number): ApiBooking[] {
  return bookings
    .filter((booking) => depositStage(booking, now) === 'awaiting')
    .sort((a, b) => holdDeadline(a) - holdDeadline(b));
}
