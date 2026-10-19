import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Amenity } from '../types/amenity';
import { AmenitiesApi } from './amenities-api';
import { apiClient } from './api';

const CCTV = { id: 'a1', code: 'CCTV', name: 'Camera' } as Amenity;
const envelope = <T>(data: T) => ({ data: { success: true, statusCode: 200, data } });

describe('AmenitiesApi', () => {
  afterEach(() => vi.restoreAllMocks());

  it('unwraps the response envelope for list, create and update', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(envelope([CCTV]));
    vi.spyOn(apiClient, 'post').mockResolvedValue(envelope(CCTV));
    vi.spyOn(apiClient, 'patch').mockResolvedValue(envelope(CCTV));

    await expect(AmenitiesApi.listActive()).resolves.toEqual([CCTV]);
    await expect(AmenitiesApi.listAdmin()).resolves.toEqual([CCTV]);
    await expect(AmenitiesApi.create({ code: 'CCTV', name: 'Camera' })).resolves.toEqual(CCTV);
    await expect(AmenitiesApi.update('a1', { isActive: false })).resolves.toEqual(CCTV);
  });
});
