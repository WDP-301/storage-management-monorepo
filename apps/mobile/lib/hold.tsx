import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { HeldBooking, UnitOffer } from '../src/types/customer';
import { DEFAULT_DURATION_MONTHS, todayIso } from './rental-schedule';

const HOLD_DURATION_MS = 15 * 60 * 1000;

/**
 * When the rental starts and how long it runs. Seeded with defaults when the units are held, then
 * settled on the schedule screen — holding must stay a single tap, because the units are contested
 * and the hold only lasts 15 minutes.
 */
export type RentalSchedule = {
  /** ISO day string; see `rental-schedule.ts`. */
  startDate: string;
  durationMonths: number;
};

type HoldContextValue = {
  heldBooking: HeldBooking | null;
  remaining: string;
  holdUnits: (units: UnitOffer[]) => void;
  setSchedule: (schedule: RentalSchedule) => void;
  clearHold: () => void;
};

const HoldContext = createContext<HoldContextValue | null>(null);

/** Mounted inside the customer area only, so signing out unmounts it and drops the hold. */
export function HoldProvider({ children }: { children: ReactNode }) {
  const [heldBooking, setHeldBooking] = useState<HeldBooking | null>(null);
  const [now, setNow] = useState(Date.now());

  const clearHold = useCallback(() => setHeldBooking(null), []);

  useEffect(() => {
    if (!heldBooking) return;

    const timer = setInterval(() => {
      const nextNow = Date.now();
      setNow(nextNow);
      setHeldBooking((current) => (current && current.holdExpiresAt <= nextNow ? null : current));
    }, 1000);

    return () => clearInterval(timer);
  }, [heldBooking]);

  const holdUnits = useCallback((units: UnitOffer[]) => {
    const createdAt = Date.now();
    setNow(createdAt);
    setHeldBooking({
      id: `BK-${String(createdAt).slice(-6)}`,
      units,
      startDate: todayIso(),
      durationMonths: DEFAULT_DURATION_MONTHS,
      holdExpiresAt: createdAt + HOLD_DURATION_MS,
    });
  }, []);

  const setSchedule = useCallback((schedule: RentalSchedule) => {
    setHeldBooking((current) => (current ? { ...current, ...schedule } : current));
  }, []);

  const remaining = useMemo(
    () => formatRemaining((heldBooking?.holdExpiresAt ?? now) - now),
    [heldBooking, now],
  );

  const value = useMemo<HoldContextValue>(
    () => ({ heldBooking, remaining, holdUnits, setSchedule, clearHold }),
    [clearHold, heldBooking, holdUnits, remaining, setSchedule],
  );

  return <HoldContext.Provider value={value}>{children}</HoldContext.Provider>;
}

export function useHold() {
  const context = useContext(HoldContext);
  if (!context) throw new Error('useHold must be used inside HoldProvider.');
  return context;
}

function formatRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
