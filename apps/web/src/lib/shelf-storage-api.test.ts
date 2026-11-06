import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './api';
import { ShelfStorageApi, toReceiptParams } from './shelf-storage-api';

const envelope = <T>(data: T) => ({ data: { success: true, statusCode: 200, data } });
const receipt = (photos: unknown[]) => ({ id: 'r1', photos, lines: [] });

describe('ShelfStorageApi', () => {
  afterEach(() => vi.restoreAllMocks());

  it('drops empty filters and stringifies booleans', () => {
    expect(
      toReceiptParams({ page: 2, limit: 20, search: '', type: undefined, disputed: true }),
    ).toEqual({ page: 2, limit: 20, disputed: 'true' });
    expect(toReceiptParams({ disputed: false, status: 'ACTIVE' })).toEqual({ status: 'ACTIVE' });
  });

  it('sends the cleaned query and keeps only photos with a file key', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(
      envelope({
        receipts: [receipt([{ fileKey: 'k', name: 'a' }, { name: 'broken' }])],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    );
    const page = await ShelfStorageApi.warehouseReceipts('w1', { search: '', status: 'ACTIVE' });
    expect(get).toHaveBeenCalledWith('/shelf-storage/warehouses/w1/receipts', {
      params: { status: 'ACTIVE' },
    });
    expect(page.receipts[0].photos).toEqual([{ fileKey: 'k', name: 'a' }]);
  });

  it('posts the void reason to the receipt', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(envelope(receipt([])));
    await ShelfStorageApi.voidReceipt('r1', { reason: 'Nhập nhầm' });
    expect(post).toHaveBeenCalledWith('/shelf-storage/receipts/r1/void', { reason: 'Nhập nhầm' });
  });

  it('asks for the requested pick-up request scope', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(envelope([]));
    await ShelfStorageApi.warehousePickupRequests('w1', 'ALL');
    expect(get).toHaveBeenCalledWith('/shelf-storage/warehouses/w1/pickup-requests', {
      params: { status: 'ALL' },
    });
  });
});
