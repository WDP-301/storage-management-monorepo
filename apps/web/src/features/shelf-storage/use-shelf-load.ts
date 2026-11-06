import { useCallback, useEffect, useRef, useState } from 'react';
import { describeLoadError } from './shelf-records-display';

interface LoadState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Loads on mount and whenever `key` changes. Only the newest request may write state, so a slow
 * answer for an older filter cannot overwrite a newer one.
 */
export function useShelfLoad<T>(load: () => Promise<T>, key: string): LoadState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  // key and tick are the triggers; the loader itself is read through the ref.
  useEffect(() => {
    const id = ++latest.current;
    setLoading(true);
    loadRef
      .current()
      .then((result) => {
        if (id !== latest.current) return;
        setData(result);
        setError(null);
      })
      .catch((err) => {
        if (id !== latest.current) return;
        setError(describeLoadError(err));
      })
      .finally(() => {
        if (id === latest.current) setLoading(false);
      });
  }, [key, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, loading, error, reload };
}
