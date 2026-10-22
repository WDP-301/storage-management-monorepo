import type { VnBank } from '@storage/types';
import { useCallback, useEffect, useState } from 'react';
import { BanksApi } from '../../../lib/banks-api';

/** The bank directory, fetched once when the form opens; `retry` runs the fetch again. */
export function useBanks() {
  const [banks, setBanks] = useState<VnBank[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    BanksApi.list()
      .then((list) => {
        if (!cancelled) setBanks(list);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { banks, isLoading, failed, retry };
}
