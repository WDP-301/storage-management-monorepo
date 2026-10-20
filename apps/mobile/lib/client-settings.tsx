import type { ClientBookingSettings } from '@storage/types';
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

type ClientSettings = {
  booking: ClientBookingSettings;
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

/**
 * Loads the admin-configured booking rules on mount and again when the app returns from the
 * background, so a long-lived session picks up changes without a restart.
 */
export function ClientSettingsProvider({ children }: { children: ReactNode }) {
  const [booking, setBooking] = useState(INITIAL_BOOKING_SETTINGS);
  const inFlight = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    SettingsApi.client(controller.signal)
      .then((result) => {
        const next = result?.booking;
        if (controller.signal.aborted || !isBookingSettings(next)) return;
        // Identical rules keep the same object, so consumers (the browse map among them) skip a render.
        setBooking((current) =>
          JSON.stringify(current) === JSON.stringify(next) ? current : next,
        );
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

  const value = useMemo(() => ({ booking, refresh }), [booking, refresh]);
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

export function useRefreshBookingSettings(): () => void {
  return useClientSettings().refresh;
}
