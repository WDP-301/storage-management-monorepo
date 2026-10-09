import type { NearbyPlacesResult } from '../src/types/storage-api';
import { request } from './api';

export type PlacePrediction = {
  place_id: string;
  description: string;
  structured_formatting?: { main_text?: string; secondary_text?: string };
};

export const NEARBY_RADIUS_KM = 5;
export const WIDE_NEARBY_RADIUS_KM = 10;

/** A nearby search is centred either on an autocomplete place or on raw GPS coordinates. */
export type NearbyCenterQuery = { placeId: string } | { lat: number; lng: number };

export const PlacesApi = {
  autocomplete: (input: string, signal?: AbortSignal) =>
    request<PlacePrediction[]>(`/places/autocomplete?input=${encodeURIComponent(input)}`, {
      signal,
    }),

  nearby: (center: NearbyCenterQuery, radiusKm = NEARBY_RADIUS_KM, signal?: AbortSignal) => {
    const params = new URLSearchParams({ radius: String(radiusKm) });
    if ('placeId' in center) {
      params.set('place_id', center.placeId);
    } else {
      params.set('lat', String(center.lat));
      params.set('lng', String(center.lng));
    }
    return request<NearbyPlacesResult>(`/places/nearby?${params.toString()}`, {
      signal,
      timeoutMs: 15000,
    });
  },
};
