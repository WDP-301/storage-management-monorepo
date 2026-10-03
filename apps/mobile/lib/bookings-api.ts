import * as Crypto from 'expo-crypto';
import type {
  ApiBooking,
  BookingItemInput,
  BookingListItemResponse,
  CreatedBooking,
} from '../src/types/booking-api';
import { request } from './api';

export const BookingsApi = {
  listMine: async (signal?: AbortSignal): Promise<ApiBooking[]> => {
    const bookings = await request<BookingListItemResponse[]>('/bookings/me', { signal });
    return bookings.map(normaliseBooking);
  },

  create: (items: BookingItemInput[], idempotencyKey: string) =>
    request<CreatedBooking>('/bookings', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ items }),
    }),

  newIdempotencyKey: () => Crypto.randomUUID(),
};

/**
 * `holdExpiresAt` wins even when it is null: the list endpoint reports null once a booking's holds
 * are released, and falling back to `expiresAt` there would revive a countdown that already ran
 * out. `expiresAt` only applies when the field is absent altogether.
 */
function normaliseBooking(booking: BookingListItemResponse): ApiBooking {
  const { holdExpiresAt, expiresAt, ...rest } = booking;
  return {
    ...rest,
    expiresAt: holdExpiresAt !== undefined ? holdExpiresAt : (expiresAt ?? null),
  };
}
