import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { HeldBooking, UnitOffer } from '../src/types/customer';
import { useSession } from './session';

const HOLD_DURATION_MS = 15 * 60 * 1000;

type HoldContextValue = {
  heldBooking: HeldBooking | null;
  remaining: string;
  holdUnits: (units: UnitOffer[]) => void;
  clearHold: () => void;
};

const HoldContext = createContext<HoldContextValue | null>(null);

export function HoldProvider({ children }: { children: ReactNode }) {
  const { user, isCheckingSession } = useSession();
  const [heldBooking, setHeldBooking] = useState<HeldBooking | null>(null);
  const [now, setNow] = useState(Date.now());

  const clearHold = useCallback(() => setHeldBooking(null), []);

  useEffect(() => {
    if (!isCheckingSession && !user) clearHold();
  }, [clearHold, isCheckingSession, user]);

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
      startDate: '28/09/2026',
      durationMonths: 3,
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
