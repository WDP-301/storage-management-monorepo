import { useEffect, useState } from 'react';
import { AmenitiesApi } from '../../../lib/amenities-api';
import type { Amenity } from '../../types/storage-api';

/** Active amenities offered as filter chips; loaded once, empty when the fetch fails. */
export function useAmenityCatalog(): Amenity[] {
  const [amenities, setAmenities] = useState<Amenity[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    AmenitiesApi.list(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setAmenities(result);
      })
      // Without the catalog the amenity row is hidden; browsing itself is unaffected.
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return amenities;
}
