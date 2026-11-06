import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { shelfApiError } from '../staff-errors';

/** Loads `fetcher` on focus and on demand; a late response of an older call never overwrites a newer one. */
export function useFocusLoader<T>(fetcher: () => Promise<T>, failure: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const call = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (call === latest.current) setData(result);
    } catch (cause) {
      if (call === latest.current) {
        setData(null);
        setError(shelfApiError(cause, failure));
      }
    } finally {
      if (call === latest.current) setLoading(false);
    }
  }, [fetcher, failure]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { data, setData, error, loading, reload };
}
