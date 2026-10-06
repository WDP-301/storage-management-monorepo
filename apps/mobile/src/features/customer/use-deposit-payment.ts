import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type DepositStage,
  depositStage,
  shouldPollDeposit,
} from '../../../lib/booking-payment-state';
import { BookingsApi } from '../../../lib/bookings-api';
import { useHold } from '../../../lib/hold';
import type { ApiBooking } from '../../types/booking-api';

/**
 * Slow enough to be cheap over mobile data, fast enough that the screen reacts while the customer
 * is still looking at their banking app. Confirmation arrives via the SePay webhook, so polling is
 * the only way the app can notice it.
 */
const POLL_INTERVAL_MS = 5000;

type DepositPayment = {
  booking: ApiBooking | null;
  stage: DepositStage | null;
  isChecking: boolean;
  error: string | null;
  /** Manual re-check, for the "I have transferred" button. */
  check: () => Promise<void>;
};

/**
 * Watches one booking until its deposit is confirmed. Results are published into the hold store so
 * the tab bar countdown and the booking list see the same booking this screen does.
 */
export function useDepositPayment(bookingId: string | undefined): DepositPayment {
  const { bookings, now, applyBooking } = useHold();
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Polling and the manual button share one in-flight slot: a slow response must not queue up
  // another request, and a double tap must not fire two.
  const inFlight = useRef(false);

  const booking = bookings.find((candidate) => candidate.id === bookingId) ?? null;
  const stage = booking ? depositStage(booking, now) : null;

  const check = useCallback(async () => {
    if (!bookingId || inFlight.current) return;
    inFlight.current = true;
    setIsChecking(true);
    try {
      applyBooking(await BookingsApi.getById(bookingId));
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không kiểm tra được trạng thái thanh toán.',
      );
    } finally {
      inFlight.current = false;
      setIsChecking(false);
    }
  }, [applyBooking, bookingId]);

  // The booking created locally from POST /bookings is a projection; one fetch on mount replaces it
  // with the server's own view before the customer acts on it.
  useEffect(() => {
    void check();
  }, [check]);

  const isPolling = stage !== null && shouldPollDeposit(stage);
  useEffect(() => {
    if (!isPolling) return;
    const timer = setInterval(() => void check(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isPolling, check]);

  return { booking, stage, isChecking, error, check };
}
