import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Warehouse } from '../types/warehouse';
import { WarehousesApi } from './api';

const row = (id: string) => ({ id }) as Warehouse;
const meta = (page: number) => ({ page, limit: 100, total: 3, totalPages: 2 });

describe('WarehousesApi.listAdminAll', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps one row per warehouse when a page shift repeats a row', async () => {
    const listAdmin = vi
      .spyOn(WarehousesApi, 'listAdmin')
      .mockResolvedValueOnce({ warehouses: [row('a'), row('b')], meta: meta(1) })
      .mockResolvedValueOnce({ warehouses: [row('b'), row('c')], meta: meta(2) });

    const all = await WarehousesApi.listAdminAll({ facilityId: 'fac-1' });

    expect(all.map((w) => w.id)).toEqual(['a', 'b', 'c']);
    expect(listAdmin).toHaveBeenCalledTimes(2);
    expect(listAdmin).toHaveBeenLastCalledWith(
      expect.objectContaining({ facilityId: 'fac-1', page: 2, limit: 100 }),
    );
  });
});
