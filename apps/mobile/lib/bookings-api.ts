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

  /**
   * One booking, fresh from the server. The deposit screen polls this while waiting for the SePay
   * webhook to confirm the transfer — the API has no push channel for it.
   */
  getById: async (id: string, signal?: AbortSignal): Promise<ApiBooking> =>
    normaliseBooking(await request<BookingListItemResponse>(`/bookings/${id}`, { signal })),

  create: (items: BookingItemInput[], idempotencyKey: string) =>
    request<CreatedBooking>('/bookings', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ items }),
    }),

  /**
   * Releases the held units. The API rejects this with 409 once a booking is CONFIRMED, and
   * answers 200 for an already-cancelled one, so callers only need to surface the message.
   *
   * Given longer than the default: this takes a row lock and updates holds and units in one
   * transaction, and the cancel commits server-side whether or not the app is still waiting —
   * timing out early only costs the app the answer, not the effect.
   */
  cancel: (id: string) =>
    request<{ message: string }>(`/bookings/${id}/cancel`, {
      method: 'POST',
      timeoutMs: 30000,
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
