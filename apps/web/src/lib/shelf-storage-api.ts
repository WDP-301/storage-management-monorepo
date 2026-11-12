import type {
  ApiResponse,
  DropOffRequestView,
  PickupRequestView,
  ShelfReceiptPage,
  ShelfReceiptView,
  VoidShelfReceiptInput,
  WarehouseReceiptQuery,
  WarehouseShelfStockView,
} from '@storage/types';
import { apiClient } from './api';

const base = '/shelf-storage';

/** Only entries that can be opened: a photo row without a key has nothing to presign. */
const withOpenablePhotos = (receipt: ShelfReceiptView): ShelfReceiptView => ({
  ...receipt,
  photos: (receipt.photos ?? []).filter((photo) => Boolean(photo.fileKey)),
});

/** Query params as the API expects them; unset filters are left out instead of sent empty. */
export function toReceiptParams(query: WarehouseReceiptQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    params[key] = typeof value === 'boolean' ? String(value) : value;
  }
  return params;
}

/** Back-office view of staff-managed shelf storage (stock, receipts, pick-up requests). */
export const ShelfStorageApi = {
  warehouseStock: async (warehouseId: string): Promise<WarehouseShelfStockView[]> => {
    const res = await apiClient.get<ApiResponse<WarehouseShelfStockView[]>>(
      `${base}/warehouses/${warehouseId}/stock`,
    );
    return res.data.data;
  },

  warehouseReceipts: async (
    warehouseId: string,
    query: WarehouseReceiptQuery = {},
  ): Promise<ShelfReceiptPage> => {
    const res = await apiClient.get<ApiResponse<ShelfReceiptPage>>(
      `${base}/warehouses/${warehouseId}/receipts`,
      { params: toReceiptParams(query) },
    );
    const page = res.data.data;
    return { ...page, receipts: page.receipts.map(withOpenablePhotos) };
  },

  warehousePickupRequests: async (
    warehouseId: string,
    status: 'OPEN' | 'ALL' = 'OPEN',
  ): Promise<PickupRequestView[]> => {
    const res = await apiClient.get<ApiResponse<PickupRequestView[]>>(
      `${base}/warehouses/${warehouseId}/pickup-requests`,
      { params: { status } },
    );
    return res.data.data;
  },

  warehouseDropOffRequests: async (
    warehouseId: string,
    status: 'OPEN' | 'ALL' = 'OPEN',
  ): Promise<DropOffRequestView[]> => {
    const res = await apiClient.get<ApiResponse<DropOffRequestView[]>>(
      `${base}/warehouses/${warehouseId}/drop-off-requests`,
      { params: { status } },
    );
    return res.data.data;
  },

  receipt: async (receiptId: string): Promise<ShelfReceiptView> => {
    const res = await apiClient.get<ApiResponse<ShelfReceiptView>>(`${base}/receipts/${receiptId}`);
    return withOpenablePhotos(res.data.data);
  },

  /** Managers only; refused when the stock was already taken out or the contract is no longer ACTIVE. */
  voidReceipt: async (
    receiptId: string,
    input: VoidShelfReceiptInput,
  ): Promise<ShelfReceiptView> => {
    const res = await apiClient.post<ApiResponse<ShelfReceiptView>>(
      `${base}/receipts/${receiptId}/void`,
      input,
    );
    return withOpenablePhotos(res.data.data);
  },
};
