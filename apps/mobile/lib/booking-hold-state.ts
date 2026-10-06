import type { ApiBooking } from '../src/types/booking-api';

/**
 * Hold state lives here so the countdown bar, the tab badge and the booking list all read the same
 * rules. A customer can hold several bookings at once, so every helper works on the whole list
 * rather than on a single "current" booking.
 */

/** Deadline as a timestamp; bookings without one sort last. */
export function holdDeadline(booking: ApiBooking): number {
  return booking.expiresAt ? new Date(booking.expiresAt).getTime() : Number.POSITIVE_INFINITY;
}

/** Still holding units: HOLDING with a deadline in the future. */
export function isActiveHold(booking: ApiBooking, now: number): boolean {
  return booking.status === 'HOLDING' && booking.expiresAt !== null && holdDeadline(booking) > now;
}

/** Deadline already passed but the API still reports HOLDING — expiry is swept server-side. */
export function isLapsedHold(booking: ApiBooking, now: number): boolean {
  return booking.status === 'HOLDING' && booking.expiresAt !== null && holdDeadline(booking) <= now;
}

/**
 * Per-booking label: `unknown` is a HOLDING booking whose deadline the API did not send, so the
 * card can ask for a refresh instead of rendering a countdown it cannot compute.
 */
export function holdState(
  booking: ApiBooking,
  now: number,
): 'active' | 'expired' | 'unknown' | 'none' {
  if (booking.status === 'EXPIRED') return 'expired';
  if (booking.status !== 'HOLDING') return 'none';
  if (!Number.isFinite(holdDeadline(booking))) return 'unknown';
  return isActiveHold(booking, now) ? 'active' : 'expired';
}

/** Active holds ordered soonest-deadline-first, so index 0 is the one about to be lost. */
export function selectActiveHolds(bookings: ApiBooking[], now: number): ApiBooking[] {
  return bookings
    .filter((booking) => isActiveHold(booking, now))
    .sort((a, b) => holdDeadline(a) - holdDeadline(b));
}

/** Units held across every active booking — not just the first one. */
export function countHeldUnits(bookings: ApiBooking[]): number {
  return bookings.reduce((total, booking) => total + booking.items.length, 0);
}

/**
 * Soonest deadline among holds that have lapsed, as the raw ISO string. Used as a refresh trigger:
 * it only changes when another hold lapses, so each expiry refetches exactly once.
 */
export function earliestLapsedDeadline(bookings: ApiBooking[], now: number): string | null {
  return bookings
    .filter((booking) => isLapsedHold(booking, now))
    .reduce<string | null>(
      (earliest, booking) =>
        !earliest || holdDeadline(booking) < new Date(earliest).getTime()
          ? booking.expiresAt
          : earliest,
      null,
    );
}

/**
 * Countdown text, floored at 00:00 so an overshoot never renders a negative value.
 *
 * `mm:ss` only holds up for a short hold. The hold length is an admin setting that goes up to 1440
 * minutes, and a day-long hold rendered as `mm:ss` reads as "1439:42" — a number nobody can parse
 * as a day. Past an hour the seconds are noise anyway, so it switches to `23h 59m`.
 */
export function formatRemaining(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const pad = (value: number) => String(value).padStart(2, '0');

  if (totalSeconds >= 3600) {
    const hours = Math.floor(totalSeconds / 3600);
    return `${hours}h ${pad(Math.floor((totalSeconds % 3600) / 60))}m`;
  }
  return `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}`;
}
