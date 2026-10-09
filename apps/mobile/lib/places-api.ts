import { request } from './api';

export type PlacePrediction = {
  place_id: string;
  description: string;
  structured_formatting?: { main_text?: string; secondary_text?: string };
};

export type NearbyPlacesResult = {
  center: { lat: number; lng: number };
  facilities: Array<{ id: string; distanceKm: number }>;
};

export const PlacesApi = {
  autocomplete: (input: string, signal?: AbortSignal) =>
    request<PlacePrediction[]>(`/places/autocomplete?input=${encodeURIComponent(input)}`, {
      signal,
    }),

  nearby: (placeId: string, signal?: AbortSignal) =>
    request<NearbyPlacesResult>(`/places/nearby?place_id=${encodeURIComponent(placeId)}&radius=5`, {
      signal,
      timeoutMs: 15000,
    }),
};
