import type { ApiResponse, ClientSettingsResponse } from '@storage/types';
import { useEffect, useState } from 'react';
import { apiClient } from './api';

/** Seeded return horizon, used until the live one loads (the API re-checks every day anyway). */
export const DEFAULT_RETURN_MAX_DAYS_AHEAD = 365;

/** The admin-configured furthest return day, in days after today. */
export function useReturnMaxDaysAhead(): number {
  const [days, setDays] = useState(DEFAULT_RETURN_MAX_DAYS_AHEAD);
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<ApiResponse<ClientSettingsResponse>>('/settings/client')
      .then((res) => {
        const live = res.data.data.return?.maxDaysAhead;
        if (!cancelled && Number.isInteger(live) && live > 0) setDays(live);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return days;
}
