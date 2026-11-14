import { useEffect, useMemo, useState } from 'react';
import { ReceivingSlotsApi } from '../../../lib/receiving-slots-api';
import {
  isWithinWindows,
  preferredInstant,
  type ReceivingDay,
  timeOptionsForDate,
} from '../../../lib/receiving-time';

/**
 * The OFFICE-shift hours a customer can be met at on `dayIso`, refetched whenever the day changes,
 * and the hour picked. Staff are assigned by that hour, so it comes from the server's shifts rather
 * than being typed freely. `preferred` (an instant) is pre-picked when its time of day is offered.
 */
export function useOfficeTimeSlots(dayIso: string | null, preferred: string | null = null) {
  const [slots, setSlots] = useState<ReceivingDay[]>([]);
  // The day the shown slots belong to: until it matches `dayIso` they are still loading, so an
  // empty list is never mistaken for a day without hours.
  const [loadedDay, setLoadedDay] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSlots([]);
    setPicked(null);
    setError(null);
    setLoadedDay(null);
    if (!dayIso) return;
    let cancelled = false;
    ReceivingSlotsApi.list(dayIso, dayIso)
      .then((days) => {
        if (cancelled) return;
        setSlots(days);
        setPicked(preferredInstant(days, dayIso, preferred));
        setLoadedDay(dayIso);
      })
      .catch(() => {
        if (!cancelled) setError('Không tải được khung giờ. Vui lòng thử lại.');
      });
    return () => {
      cancelled = true;
    };
  }, [dayIso, preferred]);

  const options = useMemo(() => timeOptionsForDate(slots, dayIso ?? ''), [slots, dayIso]);
  // The pick only counts while it still falls inside the shown day's windows.
  const chosen = dayIso && picked && isWithinWindows(slots, dayIso, picked) ? picked : null;
  const isLoading = dayIso !== null && loadedDay !== dayIso && error === null;
  const pick = (instant: string) => setPicked(instant);
  return { dayIso, options, chosen, pick, isLoading, error };
}

export type OfficeTimeSlots = ReturnType<typeof useOfficeTimeSlots>;
