import type { BookingStatus } from '@storage/types';

export type BookingItemInput = {
  storageUnitId: string;
  requestedStartAt: string;
  rentalMonths: number;
};

export type CreatedBooking = {
  id: string;
  bookingNo: string;
  status: BookingStatus;
  subtotal: string;
  depositTotal: string;
  expiresAt: string;
  items: BookingItemInput[];
};

export type ApiBookingItem = BookingItemInput & {
  id: string;
  monthlyPriceSnapshot: string;
  depositSnapshot: string;
  storageUnit: {
    id: string;
    code: string;
    zone: string | null;
    areaM2: string;
    facilityId: string;
  } | null;
};

export type ApiBooking = {
  id: string;
  bookingNo: string;
  status: BookingStatus;
  currency: string;
  subtotal: string;
  depositTotal: string;
  createdAt: string;
  expiresAt: string | null;
  items: ApiBookingItem[];
};
