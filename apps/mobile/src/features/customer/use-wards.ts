import { useEffect, useState } from 'react';
import { BrowseUnitsApi } from '../../../lib/browse-units-api';
import type { ApiWard } from '../../types/storage-api';

/**
 * Ward names for one province, loaded on demand once a province is picked.
 *
 * Facilities only store `wardCode`, so the browse filter needs this lookup to label its ward
 * options. Failures resolve to an empty map: the ward filter then stays hidden rather than
 * blocking the whole screen over a secondary lookup.
 */
export function useWards(provinceCode: string | null) {
  const [wardNames, setWardNames] = useState<ReadonlyMap<string, string>>(new Map());

  useEffect(() => {
    if (!provinceCode) {
      setWardNames(new Map());
      return;
    }

    const controller = new AbortController();

    const load = async () => {
      try {
        const wards = await BrowseUnitsApi.listWards(provinceCode, controller.signal);
        if (controller.signal.aborted) return;
        setWardNames(new Map(wards.map((ward: ApiWard) => [ward.code, ward.name])));
      } catch {
        if (!controller.signal.aborted) setWardNames(new Map());
      }
    };

    void load();

    return () => controller.abort();
  }, [provinceCode]);

  return wardNames;
}
