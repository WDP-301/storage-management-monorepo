import * as Crypto from 'expo-crypto';
import type { ApiBooking, BookingItemInput, CreatedBooking } from '../src/types/booking-api';
import { request } from './api';

export const BookingsApi = {
  listMine: (signal?: AbortSignal) => request<ApiBooking[]>('/bookings/me', { signal }),

  create: (items: BookingItemInput[], idempotencyKey: string) =>
    request<CreatedBooking>('/bookings', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ items }),
    }),

  newIdempotencyKey: () => Crypto.randomUUID(),
};
