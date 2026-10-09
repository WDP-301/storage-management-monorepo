import { useEffect, useState } from 'react';
import { WarehousesApi } from '../../../lib/warehouses-api';
import type { Warehouse } from '../../types/storage-api';

/** Warehouses never change identity mid-session, so one fetch per id is enough. */
const cache = new Map<string, Warehouse>();

/**
 * Warehouse details (name, dimensions) for ids that only arrive as bare references, such as the
 * facility id on a booking item. Misses resolve silently: callers fall back to the unit code.
 */
export function useWarehouseDetails(ids: readonly string[]): ReadonlyMap<string, Warehouse> {
  const key = [...new Set(ids.filter(Boolean))].sort().join(',');
  const [details, setDetails] = useState<ReadonlyMap<string, Warehouse>>(() => new Map(cache));

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const missing = key.split(',').filter((id) => !cache.has(id));

    const load = async () => {
      await Promise.all(
        missing.map(async (id) => {
          try {
            cache.set(id, await WarehousesApi.get(id, controller.signal));
          } catch {
            // Display-only enrichment; the card still renders with the unit code.
          }
        }),
      );
      if (!controller.signal.aborted) setDetails(new Map(cache));
    };

    void load();
    return () => controller.abort();
  }, [key]);

  return details;
}
