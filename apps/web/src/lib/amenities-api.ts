import type { ApiResponse } from '@storage/types';
import type { Amenity, AmenityInput, AmenityUpdate } from '../types/amenity';
import { apiClient } from './api';

export const AmenitiesApi = {
  /** Active amenities only, for pickers. */
  listActive: async (): Promise<Amenity[]> => {
    const res = await apiClient.get<ApiResponse<Amenity[]>>('/amenities');
    return res.data.data;
  },

  /** Every amenity including retired ones (ADMIN). */
  listAdmin: async (): Promise<Amenity[]> => {
    const res = await apiClient.get<ApiResponse<Amenity[]>>('/amenities/admin');
    return res.data.data;
  },

  create: async (input: AmenityInput): Promise<Amenity> => {
    const res = await apiClient.post<ApiResponse<Amenity>>('/amenities', input);
    return res.data.data;
  },

  update: async (id: string, patch: AmenityUpdate): Promise<Amenity> => {
    const res = await apiClient.patch<ApiResponse<Amenity>>(`/amenities/${id}`, patch);
    return res.data.data;
  },
};
