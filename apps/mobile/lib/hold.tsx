import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { HeldBooking, UnitOffer } from '../src/types/customer';

const HOLD_DURATION_MS = 15 * 60 * 1000;

/** Booking terms chosen on the browse screen; the API has no date-range availability yet. */
export type HoldOptions = {
  startDate: string;
  durationMonths: number;
};

type HoldContextValue = {
  heldBooking: HeldBooking | null;
  remaining: string;
  holdUnits: (units: UnitOffer[], options: HoldOptions) => void;
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

  const holdUnits = useCallback((units: UnitOffer[], options: HoldOptions) => {
    const createdAt = Date.now();
    setNow(createdAt);
    setHeldBooking({
      id: `BK-${String(createdAt).slice(-6)}`,
      units,
      startDate: options.startDate,
      durationMonths: options.durationMonths,
      holdExpiresAt: createdAt + HOLD_DURATION_MS,
    });
  }, []);

  const remaining = useMemo(
    () => formatRemaining((heldBooking?.holdExpiresAt ?? now) - now),
    [heldBooking, now],
  );

  const value = useMemo<HoldContextValue>(
    () => ({ heldBooking, remaining, holdUnits, clearHold }),
    [clearHold, heldBooking, holdUnits, remaining],
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
