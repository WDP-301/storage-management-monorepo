import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_BROWSE_CRITERIA } from '../../../lib/warehouse-query';
import { WarehousesApi } from '../../../lib/warehouses-api';
import type { BrowseCriteria } from '../../types/customer';
import type { ApiProvince, Warehouse } from '../../types/storage-api';
import { buildProvinceOptions, buildWardOptions } from './location-options';
import { useWards } from './use-wards';

/** Warehouses in scope of a province (or all), used only to learn which areas have stock. */
function useFacetWarehouses(provinceCode: string | null) {
  const [state, setState] = useState<{ key: string | null; warehouses: Warehouse[] } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const page = await WarehousesApi.listFacets(provinceCode, controller.signal);
        if (!controller.signal.aborted)
          setState({ key: provinceCode, warehouses: page.warehouses });
      } catch {
        // Without facets the pickers simply stay empty; the list itself is unaffected.
      }
    };
    void load();
    return () => controller.abort();
  }, [provinceCode]);

  const isReady = state?.key === provinceCode;
  return { warehouses: isReady ? state.warehouses : [], isReady };
}

/**
 * Filter state for Browse plus the province/ward options it can offer.
 *
 * The options come from two facet fetches rather than from the paged result, so choosing a ward
 * does not make the sibling wards disappear.
 */
export function useBrowseCriteria() {
  const [criteria, setCriteria] = useState<BrowseCriteria>(DEFAULT_BROWSE_CRITERIA);
  const [provinces, setProvinces] = useState<ApiProvince[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    WarehousesApi.listProvinces(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setProvinces(result);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const allFacets = useFacetWarehouses(null);
  const provinceOptions = useMemo(
    () => buildProvinceOptions(allFacets.warehouses, provinces),
    [allFacets.warehouses, provinces],
  );

  // With a single province the picker is hidden, but its wards still need to be filterable.
  const effectiveProvinceCode =
    criteria.provinceCode ?? (provinceOptions.length === 1 ? provinceOptions[0].code : null);

  const provinceFacets = useFacetWarehouses(effectiveProvinceCode);
  const wardNames = useWards(effectiveProvinceCode);
  const wardOptions = useMemo(
    () => buildWardOptions(provinceFacets.warehouses, effectiveProvinceCode, wardNames),
    [provinceFacets.warehouses, effectiveProvinceCode, wardNames],
  );

  // A code with no stock left would keep filtering with no chip to undo it, so drop it once the
  // facets that could have offered it have loaded.
  useEffect(() => {
    setCriteria((current) => {
      if (
        current.provinceCode &&
        allFacets.isReady &&
        !provinceOptions.some((option) => option.code === current.provinceCode)
      ) {
        return { ...current, provinceCode: null, wardCode: null };
      }
      if (
        current.wardCode &&
        effectiveProvinceCode &&
        provinceFacets.isReady &&
        !wardOptions.some((option) => option.code === current.wardCode)
      ) {
        return { ...current, wardCode: null };
      }
      return current;
    });
  }, [
    allFacets.isReady,
    provinceFacets.isReady,
    provinceOptions,
    wardOptions,
    effectiveProvinceCode,
  ]);

  return { criteria, setCriteria, provinceOptions, wardOptions };
}
