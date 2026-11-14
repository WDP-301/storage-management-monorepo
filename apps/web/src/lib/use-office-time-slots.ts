import { useEffect, useMemo, useState } from 'react';
import {
  MoveSlotsApi,
  type MoveTimeOption,
  type MoveWindow,
  moveTimeOptions,
  pickMoveTime,
} from './move-slots-api';

type SlotsState = 'idle' | 'loading' | 'error';

export interface OfficeTimeSlots {
  options: MoveTimeOption[];
  /** The picked slot instant; null until the day's slots loaded and one is selected. */
  chosen: string | null;
  setPick: (iso: string) => void;
  state: SlotsState;
  /** Why no slot can be picked (load failed, day has no staffed hours). */
  error: string | undefined;
  hint: string | undefined;
}

/**
 * The OFFICE-staffed hours of one Vietnam `day`, reloaded whenever the day changes. The slot
 * matching `preferredIso`'s time of day (else the first) is pre-picked; a pick only counts while
 * it is one of the shown day's slots. `noun` names the day in the copy ("hẹn trả", "chuyển đồ").
 */
export function useOfficeTimeSlots(
  day: string,
  preferredIso: string | null,
  noun: string,
): OfficeTimeSlots {
  const [windows, setWindows] = useState<MoveWindow[]>([]);
  const [pick, setPick] = useState<string | null>(null);
  // The day the shown windows belong to: until it matches `day` they are still loading, so the
  // first render never mistakes an empty list for a day without hours.
  const [loadedDay, setLoadedDay] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setWindows([]);
    setPick(null);
    setLoadedDay('');
    setFailed(false);
    if (!day) return;
    let cancelled = false;
    MoveSlotsApi.windows(day)
      .then((next) => {
        if (cancelled) return;
        setWindows(next);
        setPick(pickMoveTime(moveTimeOptions(next), preferredIso));
        setLoadedDay(day);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [day, preferredIso]);

  const state: SlotsState = failed ? 'error' : day && loadedDay !== day ? 'loading' : 'idle';

  const options = useMemo(() => moveTimeOptions(windows), [windows]);
  const chosen = options.some((o) => o.value === pick) ? pick : null;

  const error =
    state === 'error'
      ? 'Không tải được khung giờ — đóng và mở lại hộp thoại để thử lại.'
      : day && state === 'idle' && options.length === 0
        ? 'Ngày này không còn khung giờ hành chính. Vui lòng chọn ngày khác.'
        : undefined;
  const hint = !day
    ? `Chọn ngày ${noun} trước.`
    : state === 'loading'
      ? 'Đang tải khung giờ hành chính…'
      : error
        ? undefined
        : 'Chỉ hiển thị giờ trong ca hành chính còn lại của ngày.';

  return { options, chosen, setPick, state, error, hint };
}
