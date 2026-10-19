import type { Amenity } from '../src/types/storage-api';
import { request } from './api';

export const AmenitiesApi = {
  /** Active catalog entries, already ordered by the server. Public endpoint. */
  list: (signal?: AbortSignal) => request<Amenity[]>('/amenities', { signal }),
};
