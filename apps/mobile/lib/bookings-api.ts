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
    return bookings.map(({ holdExpiresAt, expiresAt, ...booking }) => ({
      ...booking,
      // An explicit null means there is no active hold; only fall back for older APIs.
      expiresAt: holdExpiresAt !== undefined ? holdExpiresAt : (expiresAt ?? null),
    }));
  },

  create: (items: BookingItemInput[], idempotencyKey: string) =>
    request<CreatedBooking>('/bookings', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ items }),
    }),

  newIdempotencyKey: () => Crypto.randomUUID(),
};
