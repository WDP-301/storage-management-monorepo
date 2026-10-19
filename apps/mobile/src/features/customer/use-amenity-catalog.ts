import { useCallback, useEffect, useRef, useState } from 'react';
import { AmenitiesApi } from '../../../lib/amenities-api';
import type { Amenity } from '../../types/storage-api';

type CatalogState = { amenities: Amenity[]; isLoaded: boolean };

/**
 * Active amenities offered as filter chips. Empty when the fetch fails (the row is hidden and
 * browsing is unaffected); `reload` retries only after a failure so healthy sessions never refetch.
 * `isLoaded` is true only after a successful fetch, so callers never act on a failed load's `[]`.
 */
export function useAmenityCatalog(): CatalogState & { reload: () => void } {
  const [state, setState] = useState<CatalogState>({ amenities: [], isLoaded: false });
  const [attempt, setAttempt] = useState(0);
  const hasFailed = useRef(false);

  useEffect(() => {
    // `attempt` re-runs this effect for a retry; it is not read inside.
    void attempt;
    const controller = new AbortController();
    AmenitiesApi.list(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        hasFailed.current = false;
        setState({ amenities: result, isLoaded: true });
      })
      .catch(() => {
        if (!controller.signal.aborted) hasFailed.current = true;
      });
    return () => controller.abort();
  }, [attempt]);

  const reload = useCallback(() => {
    if (hasFailed.current) {
      hasFailed.current = false;
      setAttempt((current) => current + 1);
    }
  }, []);

  return { ...state, reload };
}
