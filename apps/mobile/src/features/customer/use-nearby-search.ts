import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../lib/api';
import { type Coords, getCurrentCoords, LocationError } from '../../../lib/current-location';
import {
  NEARBY_RADIUS_KM,
  type NearbyCenterQuery,
  type PlacePrediction,
  PlacesApi,
  WIDE_NEARBY_RADIUS_KM,
} from '../../../lib/places-api';
import type { NearbyWarehouse } from '../../types/storage-api';

export type NearbySearch = {
  /** `me` = the customer's GPS position, `place` = an autocomplete pick. */
  source: 'place' | 'me';
  label: string;
  center: Coords;
  radiusKm: number;
  /** Already sorted nearest-first by the API. */
  warehouses: NearbyWarehouse[];
  /** Kept so widening or refreshing re-asks the API about the same center. */
  query: NearbyCenterQuery;
};

const ME_LABEL = 'Vị trí của bạn';

/** One nearby search shared by the list and the map, centred on a place or on the customer. */
export function useNearbySearch() {
  const [search, setSearch] = useState<NearbySearch | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  // Starting a new search cancels the previous one, so a slow answer never overwrites a newer pick.
  const run = async (
    source: NearbySearch['source'],
    label: string,
    query: NearbyCenterQuery,
    radiusKm: number,
  ) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    let result: Awaited<ReturnType<typeof PlacesApi.nearby>>;
    try {
      result = await PlacesApi.nearby(query, radiusKm, controller.signal);
    } catch (cause) {
      // `request` reports a cancelled fetch as a connection error; a superseded search is not one.
      if (controller.signal.aborted) return;
      throw cause;
    }
    if (controller.signal.aborted) return;
    setSearch({
      source,
      label,
      center: result.center,
      radiusKm,
      warehouses: result.warehouses,
      query,
    });
  };

  // Wraps the user-triggered actions: one at a time, failures shown as a message.
  const guarded = async (action: () => Promise<void>) => {
    if (isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof LocationError || cause instanceof ApiError
          ? cause.message
          : 'Không tải được kho gần đây. Hãy thử lại.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  /** Errors propagate so the place-search sheet can show them next to the suggestions. */
  const searchPlace = async (place: PlacePrediction) => {
    setError(null);
    await run(
      'place',
      place.structured_formatting?.main_text ?? place.description,
      { placeId: place.place_id },
      NEARBY_RADIUS_KM,
    );
  };

  const searchNearMe = () =>
    guarded(async () => {
      const coords = await getCurrentCoords();
      await run('me', ME_LABEL, coords, NEARBY_RADIUS_KM);
    });

  const widenRadius = () =>
    guarded(async () => {
      if (search) await run(search.source, search.label, search.query, WIDE_NEARBY_RADIUS_KM);
    });

  const refresh = () =>
    guarded(async () => {
      if (search) await run(search.source, search.label, search.query, search.radiusKm);
    });

  const clear = () => {
    controllerRef.current?.abort();
    setSearch(null);
    setError(null);
  };

  return {
    search,
    isBusy,
    error,
    canWiden: search !== null && search.radiusKm < WIDE_NEARBY_RADIUS_KM,
    searchPlace,
    searchNearMe,
    widenRadius,
    refresh,
    clear,
    dismissError: () => setError(null),
  };
}
