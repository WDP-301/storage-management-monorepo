import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ApiBooking, BookingItemInput, CreatedBooking } from '../src/types/booking-api';
import type { UnitOffer } from '../src/types/customer';
import {
  countHeldUnits,
  earliestLapsedDeadline,
  formatRemaining,
  holdDeadline,
  selectActiveHolds,
} from './booking-hold-state';
import { BookingsApi } from './bookings-api';

export type RentalSchedule = {
  startDate: string;
  durationMonths: number;
};

type HoldContextValue = {
  selectedUnits: UnitOffer[] | null;
  bookings: ApiBooking[];
  /** Every booking still holding units, soonest deadline first. */
  activeHolds: ApiBooking[];
  /** The hold about to expire — `activeHolds[0]`, kept for screens that only need one. */
  heldBooking: ApiBooking | null;
  /** Units held across all active bookings, which is what the customer actually has reserved. */
  heldUnitCount: number;
  remaining: string;
  /** Shared clock so every consumer classifies holds against the same instant. */
  now: number;
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  selectUnits: (units: UnitOffer[]) => void;
  clearSelection: () => void;
  /** Resolves to the created booking so the caller can send the customer straight to its deposit. */
  createBooking: (schedule: RentalSchedule) => Promise<ApiBooking | null>;
  refreshBookings: () => Promise<void>;
  /** Merges one freshly fetched booking into the list — how deposit polling publishes its result. */
  applyBooking: (booking: ApiBooking) => void;
};

const HoldContext = createContext<HoldContextValue | null>(null);

export function HoldProvider({ children }: { children: ReactNode }) {
  const [selectedUnits, setSelectedUnits] = useState<UnitOffer[] | null>(null);
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const selectionKey = useRef<string | null>(null);
  const refreshedExpiry = useRef<string | null>(null);
  const submitting = useRef(false);
  const requestSequence = useRef(0);

  const refreshBookings = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setIsLoading(true);
    try {
      const result = await BookingsApi.listMine();
      if (sequence === requestSequence.current) {
        setBookings(result);
        // The ticker pauses while nothing is held, so `now` can be stale by the time fresh holds
        // arrive. Resyncing here keeps the first rendered countdown accurate.
        setNow(Date.now());
        setError(null);
      }
    } catch (cause) {
      if (sequence === requestSequence.current) {
        setError(
          cause instanceof Error ? cause.message : 'Không tải được booking. Vui lòng thử lại.',
        );
        throw cause;
      }
    } finally {
      if (sequence === requestSequence.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshBookings().catch(() => undefined);
  }, [refreshBookings]);

  const activeHolds = useMemo(() => selectActiveHolds(bookings, now), [bookings, now]);
  // Soonest deadline first, so the bar counts down the hold that is actually at risk.
  const heldBooking = activeHolds[0] ?? null;
  const heldUnitCount = countHeldUnits(activeHolds);

  // Ticking only matters while something is held; the last tick that empties `activeHolds` also
  // tears the interval down.
  const hasActiveHold = activeHolds.length > 0;
  useEffect(() => {
    if (!hasActiveHold) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasActiveHold]);

  const lapsedDeadline = earliestLapsedDeadline(bookings, now);
  useEffect(() => {
    if (!lapsedDeadline || refreshedExpiry.current === lapsedDeadline) return;
    refreshedExpiry.current = lapsedDeadline;
    void refreshBookings().catch(() => undefined);
  }, [lapsedDeadline, refreshBookings]);

  const selectUnits = useCallback((units: UnitOffer[]) => {
    if (submitting.current) return;
    selectionKey.current = BookingsApi.newIdempotencyKey();
    setSelectedUnits(units);
  }, []);
  const clearSelection = useCallback(() => {
    setSelectedUnits(null);
    selectionKey.current = null;
  }, []);

  const createBooking = useCallback(
    async (schedule: RentalSchedule) => {
      if (!selectedUnits?.length || !selectionKey.current || submitting.current) return null;
      const items: BookingItemInput[] = selectedUnits.map((unit) => ({
        storageUnitId: unit.id,
        // Noon UTC keeps the selected calendar day stable for the API's date validation.
        requestedStartAt: `${schedule.startDate}T12:00:00.000Z`,
        rentalMonths: schedule.durationMonths,
      }));
      submitting.current = true;
      setIsCreating(true);
      try {
        // A lost response may still represent a committed booking. Keep the selection's key
        // even if the schedule changes, so retries cannot accidentally create a new request.
        const created = await BookingsApi.create(items, selectionKey.current);
        const booking = toBooking(created, selectedUnits);
        requestSequence.current += 1;
        setBookings((current) => [booking, ...current.filter((b) => b.id !== created.id)]);
        setNow(Date.now());
        clearSelection();
        void refreshBookings().catch(() => undefined);
        return booking;
      } finally {
        submitting.current = false;
        setIsCreating(false);
      }
    },
    [clearSelection, refreshBookings, selectedUnits],
  );

  const applyBooking = useCallback((booking: ApiBooking) => {
    setBookings((current) => {
      const index = current.findIndex((b) => b.id === booking.id);
      if (index === -1) return [booking, ...current];
      const next = [...current];
      next[index] = booking;
      return next;
    });
    // Same reason as in refreshBookings: a paused ticker leaves `now` stale, and the deposit
    // countdown would render against the wrong instant on the first frame after a poll.
    setNow(Date.now());
  }, []);

  const remaining = useMemo(
    () => formatRemaining((heldBooking ? holdDeadline(heldBooking) : now) - now),
    [heldBooking, now],
  );

  const value = useMemo<HoldContextValue>(
    () => ({
      selectedUnits,
      bookings,
      activeHolds,
      heldBooking,
      heldUnitCount,
      remaining,
      now,
      isLoading,
      isCreating,
      error,
      selectUnits,
      clearSelection,
      createBooking,
      refreshBookings,
      applyBooking,
    }),
    [
      selectedUnits,
      bookings,
      activeHolds,
      heldBooking,
      heldUnitCount,
      remaining,
      now,
      isLoading,
      isCreating,
      error,
      selectUnits,
      clearSelection,
      createBooking,
      refreshBookings,
      applyBooking,
    ],
  );

  return <HoldContext.Provider value={value}>{children}</HoldContext.Provider>;
}

export function useHold() {
  const context = useContext(HoldContext);
  if (!context) throw new Error('useHold must be used inside HoldProvider.');
  return context;
}

function toBooking(created: CreatedBooking, units: UnitOffer[]): ApiBooking {
  // A booking this fresh has never been updated, so both stamps are "now". The deposit receipt
  // only reads `updatedAt` once the server has confirmed the booking and sent its own copy back.
  const now = new Date().toISOString();
  return {
    ...created,
    currency: 'VND',
    createdAt: now,
    updatedAt: now,
    items: created.items.map((item, index) => {
      const unit = units.find((candidate) => candidate.id === item.storageUnitId) ?? units[index];
      return {
        ...item,
        id: `${created.id}-${item.storageUnitId}`,
        monthlyPriceSnapshot: String(unit?.monthlyPrice ?? 0),
        depositSnapshot: String(unit?.deposit ?? 0),
        storageUnit: {
          id: item.storageUnitId,
          code: unit?.code ?? item.storageUnitId,
          zone: unit?.zone ?? null,
          areaM2: String(unit?.areaM2 ?? 0),
          facilityId: unit?.facilityId ?? '',
        },
      };
    }),
  };
}
