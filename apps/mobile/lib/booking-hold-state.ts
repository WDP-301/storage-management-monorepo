import type { ApiBooking } from '../src/types/booking-api';

export function holdState(
  booking: ApiBooking,
  now: number,
): 'active' | 'expired' | 'unknown' | 'none' {
  if (booking.status === 'EXPIRED') return 'expired';
  if (booking.status !== 'HOLDING') return 'none';
  const expiresAt = booking.expiresAt ? Date.parse(booking.expiresAt) : Number.NaN;
  if (!Number.isFinite(expiresAt)) return 'unknown';
  return expiresAt > now ? 'active' : 'expired';
}
