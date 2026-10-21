import type { ClientBookingSettings, ClientReturnSettings } from '@storage/types';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { SettingsApi } from './settings-api';

/**
 * The server's seeded values, used only until the first fetch lands (or if it fails). The API still
 * validates every booking against the live rules, so a stale value costs a rejected request, never
 * a wrong booking — and that rejection triggers a refresh.
 */
const INITIAL_BOOKING_SETTINGS: ClientBookingSettings = {
  rentalMonthsOptions: [6, 12, 18],
  defaultRentalMonths: 6,
  minRentalMonths: 6,
  maxRentalMonths: 60,
  leadDays: 30,
  maxUnitsPerBooking: 4,
};

/** Seeded return rules; shown in copy only — the server applies the rules a request captured. */
const INITIAL_RETURN_SETTINGS: ClientReturnSettings = {
  noticeDays: 30,
  overduePenaltyPercent: 100,
};

type ClientSettings = {
  booking: ClientBookingSettings;
  return: ClientReturnSettings;
  /** Refetches the rules, e.g. after the API rejected a booking under rules that have changed. */
  refresh: () => void;
};

const Context = createContext<ClientSettings | null>(null);

/** Installed builds outlive API changes: a payload of the wrong shape is ignored, not rendered. */
function isBookingSettings(value: unknown): value is ClientBookingSettings {
  const settings = value as Partial<ClientBookingSettings> | null | undefined;
  return (
    Array.isArray(settings?.rentalMonthsOptions) &&
    settings.rentalMonthsOptions.length > 0 &&
    settings.rentalMonthsOptions.every(Number.isFinite) &&
    [
      settings.defaultRentalMonths,
      settings.minRentalMonths,
      settings.maxRentalMonths,
      settings.leadDays,
      settings.maxUnitsPerBooking,
    ].every(Number.isFinite)
  );
}

function isReturnSettings(value: unknown): value is ClientReturnSettings {
  const settings = value as Partial<ClientReturnSettings> | null | undefined;
  return (
    Number.isInteger(settings?.noticeDays) &&
    (settings?.noticeDays ?? -1) >= 0 &&
    Number.isFinite(settings?.overduePenaltyPercent) &&
    (settings?.overduePenaltyPercent ?? -1) >= 0
  );
}

/** Identical rules keep the same object, so consumers (the browse map among them) skip a render. */
const keepIfSame = <T,>(current: T, next: T): T =>
  JSON.stringify(current) === JSON.stringify(next) ? current : next;

/**
 * Loads the admin-configured booking and return rules on mount and again when the app returns from the
 * background, so a long-lived session picks up changes without a restart.
 */
export function ClientSettingsProvider({ children }: { children: ReactNode }) {
  const [booking, setBooking] = useState(INITIAL_BOOKING_SETTINGS);
  const [returnRules, setReturnRules] = useState(INITIAL_RETURN_SETTINGS);
  const inFlight = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    SettingsApi.client(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        // Each group is checked on its own: an API without return rules keeps the defaults.
        const nextBooking = result?.booking;
        if (isBookingSettings(nextBooking)) {
          setBooking((current) => keepIfSame(current, nextBooking));
        }
        const nextReturn = result?.return;
        if (isReturnSettings(nextReturn)) {
          setReturnRules((current) => keepIfSame(current, nextReturn));
        }
      })
      // Keep the last known rules; the next return from background or booking rejection retries.
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    // Only a real trip to the background counts: iOS also passes through `inactive` for Control
    // Center, Face ID and permission prompts, which are not worth a round trip.
    let wasBackgrounded = false;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') wasBackgrounded = true;
      if (state === 'active' && wasBackgrounded) {
        wasBackgrounded = false;
        refresh();
      }
    });
    return () => {
      subscription.remove();
      inFlight.current?.abort();
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ booking, return: returnRules, refresh }),
    [booking, returnRules, refresh],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

function useClientSettings(): ClientSettings {
  const value = useContext(Context);
  if (!value) throw new Error('ClientSettingsProvider is missing');
  return value;
}

export function useBookingSettings(): ClientBookingSettings {
  return useClientSettings().booking;
}

/** Notice and overstay rules, for copy shown before the customer asks to move out. */
export function useReturnSettings(): ClientReturnSettings {
  return useClientSettings().return;
}

export function useRefreshBookingSettings(): () => void {
  return useClientSettings().refresh;
}
