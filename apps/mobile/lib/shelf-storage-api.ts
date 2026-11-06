import type {
  AbandonedShelfContractView,
  CounterSessionView,
  CreatePickupRequestInput,
  CreateShelfReceiptInput,
  CreateShelfRecoveryInput,
  OpenCounterSessionInput,
  PickupRequestView,
  ShelfContractStorageView,
  ShelfReceiptPage,
  ShelfReceiptView,
  VoidShelfReceiptInput,
} from '@storage/types';
import { request } from './api';
import { isEvidenceFile } from './evidence';

export type ScanWarehouse = {
  id: string;
  code: string;
  name: string;
  facility: { id: string; code: string; name: string };
};

/** Photos come from the receipt's jsonb column; older or foreign entries without a file key are dropped. */
export function normaliseReceipt(receipt: ShelfReceiptView): ShelfReceiptView {
  return { ...receipt, photos: (receipt.photos ?? []).filter(isEvidenceFile) };
}

export function normaliseSession(session: CounterSessionView): CounterSessionView {
  return {
    ...session,
    contracts: session.contracts.map((contract) => ({
      ...contract,
      recentReceipts: contract.recentReceipts.map(normaliseReceipt),
    })),
  };
}

const normalisePage = (page: ShelfReceiptPage): ShelfReceiptPage => ({
  ...page,
  receipts: page.receipts.map(normaliseReceipt),
});

const enc = encodeURIComponent;
const json = (method: 'POST', body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

function pageQuery(page: number, limit: number, search?: string): string {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search?.trim()) params.set('search', search.trim());
  return params.toString();
}

export const ShelfStorageApi = {
  /** Shelf warehouses at the facilities the staff member works at: the places a code can open. */
  scanWarehouses: async (): Promise<ScanWarehouse[]> => {
    const units = await request<(ScanWarehouse & { kind: string })[]>('/warehouses/mine');
    return units
      .filter((unit) => unit.kind === 'SHELF_WAREHOUSE')
      .map(({ id, code, name, facility }) => ({ id, code, name, facility }));
  },

  /** Staff scan the customer's code: consumes it and opens a counter session. */
  openSession: async (input: OpenCounterSessionInput) =>
    normaliseSession(
      await request<CounterSessionView>('/shelf-storage/sessions', json('POST', input)),
    ),
  /** The scanning staff member's session with fresh stock. */
  getSession: async (sessionId: string) =>
    normaliseSession(
      await request<CounterSessionView>(`/shelf-storage/sessions/${enc(sessionId)}`),
    ),

  createReceipt: async (input: CreateShelfReceiptInput) =>
    normaliseReceipt(
      await request<ShelfReceiptView>('/shelf-storage/receipts', json('POST', input)),
    ),
  getReceipt: async (receiptId: string) =>
    normaliseReceipt(await request<ShelfReceiptView>(`/shelf-storage/receipts/${enc(receiptId)}`)),
  voidReceipt: async (receiptId: string, input: VoidShelfReceiptInput) =>
    normaliseReceipt(
      await request<ShelfReceiptView>(
        `/shelf-storage/receipts/${enc(receiptId)}/void`,
        json('POST', input),
      ),
    ),
  warehouseReceipts: async (warehouseId: string, page = 1, limit = 20, search?: string) =>
    normalisePage(
      await request<ShelfReceiptPage>(
        `/shelf-storage/warehouses/${enc(warehouseId)}/receipts?${pageQuery(page, limit, search)}`,
      ),
    ),

  contractStorage: (contractId: string) =>
    request<ShelfContractStorageView>(`/shelf-storage/contracts/${enc(contractId)}`),
  contractReceipts: async (contractId: string, page = 1, limit = 20) =>
    normalisePage(
      await request<ShelfReceiptPage>(
        `/shelf-storage/contracts/${enc(contractId)}/receipts?${pageQuery(page, limit)}`,
      ),
    ),

  /** Customer: their latest pick-up requests for the contract. */
  contractPickupRequests: (contractId: string) =>
    request<PickupRequestView[]>(`/shelf-storage/contracts/${enc(contractId)}/pickup-requests`),
  createPickupRequest: (contractId: string, input: CreatePickupRequestInput) =>
    request<PickupRequestView>(
      `/shelf-storage/contracts/${enc(contractId)}/pickup-requests`,
      json('POST', input),
    ),
  cancelPickupRequest: (requestId: string) =>
    request<PickupRequestView>(
      `/shelf-storage/pickup-requests/${enc(requestId)}/cancel`,
      json('POST'),
    ),

  /** Staff: open requests (soonest first) or the latest 50 of any status. */
  warehousePickupRequests: (warehouseId: string, status: 'OPEN' | 'ALL' = 'OPEN') =>
    request<PickupRequestView[]>(
      `/shelf-storage/warehouses/${enc(warehouseId)}/pickup-requests?status=${status}`,
    ),
  markPickupReady: (requestId: string) =>
    request<PickupRequestView>(
      `/shelf-storage/pickup-requests/${enc(requestId)}/ready`,
      json('POST'),
    ),

  /** Managers: abandoned returns that still have goods on the shelf. */
  abandonedContracts: (warehouseId: string) =>
    request<AbandonedShelfContractView[]>(
      `/shelf-storage/warehouses/${enc(warehouseId)}/abandoned-contracts`,
    ),
  /** Managers: scan-less pick-up of an abandoned shelf. */
  createRecovery: async (input: CreateShelfRecoveryInput) =>
    normaliseReceipt(
      await request<ShelfReceiptView>('/shelf-storage/recoveries', json('POST', input)),
    ),
};
