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
import type { Warehouse } from '../src/types/storage-api';
import {
  countHeldUnits,
  earliestLapsedDeadline,
  formatRemaining,
  holdDeadline,
  selectActiveHolds,
} from './booking-hold-state';
import { BookingsApi } from './bookings-api';
import { buildBookingItems, warehouseDeposit } from './warehouse-query';

export type RentalSchedule = {
  startDate: string;
  durationMonths: number;
};

type HoldContextValue = {
  selectedWarehouses: Warehouse[] | null;
  bookings: ApiBooking[];
  /** Every booking still holding units, soonest deadline first. */
  activeHolds: ApiBooking[];
  /** The hold about to expire — `activeHolds[0]`, kept for screens that only need one. */
  heldBooking: ApiBooking | null;
  /** Units held across all active bookings, which is what the customer actually has reserved. */
  heldUnitCount: number;
  remaining: string;
  /**
   * `true` in the last two minutes of the soonest hold, so the UI can warn before it lapses.
   * Derived here rather than parsed back out of `remaining` by each consumer.
   */
  isExpiringSoon: boolean;
  /** Shared clock so every consumer classifies holds against the same instant. */
  now: number;
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  selectWarehouses: (warehouses: Warehouse[]) => void;
  clearSelection: () => void;
  /** Resolves to the created booking so the caller can send the customer straight to its deposit. */
  createBooking: (schedule: RentalSchedule) => Promise<ApiBooking | null>;
  refreshBookings: () => Promise<void>;
  /** Merges one freshly fetched booking into the list — how deposit polling publishes its result. */
  applyBooking: (booking: ApiBooking) => void;
  /** Releases the held units. Rejects with the API's message when the booking cannot be cancelled. */
  cancelBooking: (bookingId: string) => Promise<void>;
};

/** Two minutes: long enough to finish paying, short enough that the warning still means something. */
const EXPIRING_SOON_MS = 2 * 60 * 1000;

const HoldContext = createContext<HoldContextValue | null>(null);

export function HoldProvider({ children }: { children: ReactNode }) {
  const [selectedWarehouses, setSelectedWarehouses] = useState<Warehouse[] | null>(null);
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

  const selectWarehouses = useCallback((warehouses: Warehouse[]) => {
    if (submitting.current) return;
    selectionKey.current = BookingsApi.newIdempotencyKey();
    setSelectedWarehouses(warehouses);
  }, []);
  const clearSelection = useCallback(() => {
    setSelectedWarehouses(null);
    selectionKey.current = null;
  }, []);

  const createBooking = useCallback(
    async (schedule: RentalSchedule) => {
      if (!selectedWarehouses?.length || !selectionKey.current || submitting.current) return null;
      const items: BookingItemInput[] = buildBookingItems(
        selectedWarehouses,
        schedule.startDate,
        schedule.durationMonths,
      );
      submitting.current = true;
      setIsCreating(true);
      try {
        // A lost response may still represent a committed booking. Keep the selection's key
        // even if the schedule changes, so retries cannot accidentally create a new request.
        const created = await BookingsApi.create(items, selectionKey.current);
        const booking = toBooking(created, selectedWarehouses);
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
    [clearSelection, refreshBookings, selectedWarehouses],
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

  const cancelBooking = useCallback(
    async (bookingId: string) => {
      try {
        await BookingsApi.cancel(bookingId);
      } finally {
        // Refresh even when the call rejected. A request that times out or loses its response on
        // the way back may still have cancelled the booking server-side, and showing the customer
        // a hold that no longer exists is worse than the failed request itself. Cancelling also
        // frees units, so the whole list is stale, not just this row.
        await refreshBookings().catch(() => undefined);
      }
    },
    [refreshBookings],
  );

  const msLeft = heldBooking ? holdDeadline(heldBooking) - now : 0;
  const remaining = useMemo(() => formatRemaining(msLeft), [msLeft]);
  const isExpiringSoon = Boolean(heldBooking) && msLeft > 0 && msLeft <= EXPIRING_SOON_MS;

  const value = useMemo<HoldContextValue>(
    () => ({
      selectedWarehouses,
      bookings,
      activeHolds,
      heldBooking,
      heldUnitCount,
      remaining,
      isExpiringSoon,
      now,
      isLoading,
      isCreating,
      error,
      selectWarehouses,
      clearSelection,
      createBooking,
      refreshBookings,
      applyBooking,
      cancelBooking,
    }),
    [
      selectedWarehouses,
      bookings,
      activeHolds,
      heldBooking,
      heldUnitCount,
      remaining,
      isExpiringSoon,
      now,
      isLoading,
      isCreating,
      error,
      selectWarehouses,
      clearSelection,
      createBooking,
      refreshBookings,
      applyBooking,
      cancelBooking,
    ],
  );

  return <HoldContext.Provider value={value}>{children}</HoldContext.Provider>;
}

export function useHold() {
  const context = useContext(HoldContext);
  if (!context) throw new Error('useHold must be used inside HoldProvider.');
  return context;
}

function toBooking(created: CreatedBooking, warehouses: Warehouse[]): ApiBooking {
  // A booking this fresh has never been updated, so both stamps are "now". The deposit receipt
  // only reads `updatedAt` once the server has confirmed the booking and sent its own copy back.
  const now = new Date().toISOString();
  return {
    ...created,
    currency: 'VND',
    createdAt: now,
    updatedAt: now,
    items: created.items.map((item, index) => {
      const warehouse =
        warehouses.find((candidate) => candidate.unitId === item.storageUnitId) ??
        warehouses[index];
      return {
        ...item,
        id: `${created.id}-${item.storageUnitId}`,
        monthlyPriceSnapshot: String(warehouse?.monthlyPrice ?? 0),
        depositSnapshot: String(warehouse ? warehouseDeposit(warehouse) : 0),
        storageUnit: {
          id: item.storageUnitId,
          code: warehouse?.code ?? item.storageUnitId,
          areaM2: String(warehouse?.areaM2 ?? 0),
          facilityId: warehouse?.id ?? '',
        },
      };
    }),
  };
}
