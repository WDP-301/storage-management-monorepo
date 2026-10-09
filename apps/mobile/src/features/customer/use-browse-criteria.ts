import { useEffect, useMemo, useState } from 'react';
import type { BrowseCriteria, FacilityOffer } from '../../types/customer';
import type { ApiProvince } from '../../types/storage-api';
import {
  applyBrowseFilters,
  countAreaPresetMatches,
  countPricePresetMatches,
  DEFAULT_BROWSE_CRITERIA,
  pruneStaleLocationCodes,
} from './browse-filters';
import { buildProvinceOptions, buildWardOptions } from './location-options';
import { useWards } from './use-wards';

/**
 * Filter state for Browse, plus everything derived from it.
 *
 * Extracted from `BrowseUnitsScreen` once the map view pushed that file past the size cap. The
 * screen keeps the view/selection state it actually renders with; the filtering maths lives here.
 */
export function useBrowseCriteria(
  facilities: readonly FacilityOffer[],
  provinces: readonly ApiProvince[],
) {
  const [criteria, setCriteria] = useState<BrowseCriteria>(DEFAULT_BROWSE_CRITERIA);

  const provinceOptions = useMemo(
    () => buildProvinceOptions(facilities, provinces),
    [facilities, provinces],
  );

  // With a single province the picker is hidden, but its wards still need to be filterable —
  // which is the common case of one city holding every facility.
  const effectiveProvinceCode =
    criteria.provinceCode ?? (provinceOptions.length === 1 ? provinceOptions[0].code : null);

  const wardNames = useWards(effectiveProvinceCode);
  const wardOptions = useMemo(
    () => buildWardOptions(facilities, effectiveProvinceCode, wardNames),
    [facilities, effectiveProvinceCode, wardNames],
  );
  const visibleFacilities = useMemo(
    () => applyBrowseFilters(facilities, criteria),
    [facilities, criteria],
  );
  const areaCounts = useMemo(
    () => countAreaPresetMatches(facilities, criteria),
    [facilities, criteria],
  );
  const priceCounts = useMemo(
    () => countPricePresetMatches(facilities, criteria),
    [facilities, criteria],
  );

  // Location codes outlive the data they came from, so a reload can leave a filter active with no
  // chip to switch it off. Re-running on every options change converges: once pruned, the codes
  // are valid and this returns the criteria untouched.
  useEffect(() => {
    setCriteria((current) => pruneStaleLocationCodes(current, provinceOptions, wardOptions));
  }, [provinceOptions, wardOptions]);

  return {
    criteria,
    setCriteria,
    provinceOptions,
    wardOptions,
    visibleFacilities,
    areaCounts,
    priceCounts,
  };
}
