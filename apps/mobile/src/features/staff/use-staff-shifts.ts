import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  describeShiftError,
  shiftWeekRange,
  vietnamTodayIso,
} from '../../../lib/staff-shift-state';
import { StaffShiftsApi } from '../../../lib/staff-shifts-api';
import type { StaffShiftRecord } from '../../types/staff-shift-api';

/** Own shift schedule for one Monday–Sunday week (31-day API limit safe), plus check-in/out. */
export function useStaffShifts(enabled: boolean, initialWeekOffset = 0) {
  const [weekOffset, setWeekOffset] = useState(initialWeekOffset);
  const [shifts, setShifts] = useState<StaffShiftRecord[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyShiftId, setBusyShiftId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const range = useMemo(() => shiftWeekRange(weekOffset, nowMs), [weekOffset, nowMs]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        setShifts([]);
        setIsLoading(false);
        setError(null);
        return;
      }
      const controller = new AbortController();
      setIsLoading(true);
      setError(null);

      StaffShiftsApi.listMine(range.from, range.to, controller.signal)
        .then((rows) => {
          if (!controller.signal.aborted) {
            setShifts(rows);
            setNowMs(Date.now());
          }
        })
        .catch((err) => {
          if (!controller.signal.aborted) {
            setError(describeShiftError(err, 'Không tải được lịch ca làm việc.'));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });

      return () => controller.abort();
    }, [enabled, range.from, range.to, reloadToken]),
  );

  const refetch = useCallback(() => {
    setNowMs(Date.now());
    setReloadToken((t) => t + 1);
  }, []);

  const replaceShift = (updated: StaffShiftRecord) => {
    setShifts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  const checkIn = useCallback(async (id: string): Promise<boolean> => {
    setBusyShiftId(id);
    setActionError(null);
    try {
      const updated = await StaffShiftsApi.checkIn(id);
      replaceShift(updated);
      setNowMs(Date.now());
      return true;
    } catch (err) {
      setActionError(describeShiftError(err, 'Không thể check-in lúc này.'));
      return false;
    } finally {
      setBusyShiftId(null);
    }
  }, []);

  const checkOut = useCallback(async (id: string): Promise<boolean> => {
    setBusyShiftId(id);
    setActionError(null);
    try {
      const updated = await StaffShiftsApi.checkOut(id);
      replaceShift(updated);
      setNowMs(Date.now());
      return true;
    } catch (err) {
      setActionError(describeShiftError(err, 'Không thể check-out lúc này.'));
      return false;
    } finally {
      setBusyShiftId(null);
    }
  }, []);

  return {
    weekOffset,
    setWeekOffset,
    range,
    todayIso: vietnamTodayIso(nowMs),
    nowMs,
    shifts,
    isLoading,
    error,
    actionError,
    busyShiftId,
    refetch,
    checkIn,
    checkOut,
  };
}
