import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../../lib/api';
import { BrowseUnitsApi } from '../../../lib/browse-units-api';
import type { FacilityOffer } from '../../types/customer';
import type { ApiProvince } from '../../types/storage-api';
import { groupUnitsByFacility } from './storage-unit-mapper';

type AvailableUnitsState = {
  /** Available units grouped by facility, cheapest first. */
  facilities: FacilityOffer[];
  /** Province list, used to resolve facility province codes into names. */
  provinces: ApiProvince[];
  /** `true` when the page cap truncated the result, so the list is incomplete. */
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
};

const INITIAL_STATE: AvailableUnitsState = {
  facilities: [],
  provinces: [],
  hasMore: false,
  isLoading: true,
  error: null,
};

/** Loads everything the browse screen filters over. Both endpoints are public — no session needed. */
export function useAvailableUnits() {
  const [state, setState] = useState<AvailableUnitsState>(INITIAL_STATE);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, isLoading: true, error: null }));

    const load = async () => {
      try {
        const [unitsResult, provinces] = await Promise.all([
          BrowseUnitsApi.listAvailableUnits(controller.signal),
          BrowseUnitsApi.listProvinces(controller.signal),
        ]);
        // An aborted fetch surfaces as a connection ApiError, so bail before touching state.
        if (controller.signal.aborted) return;

        const provinceNames = new Map(provinces.map((province) => [province.code, province.name]));
        setState({
          facilities: groupUnitsByFacility(unitsResult.units, provinceNames),
          provinces,
          hasMore: unitsResult.hasMore,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState((current) => ({ ...current, isLoading: false, error: toErrorMessage(error) }));
      }
    };

    void load();

    return () => controller.abort();
  }, [reloadToken]);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  return { ...state, refetch };
}

function toErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return 'Không tải được danh sách kho. Vui lòng thử lại.';
}
