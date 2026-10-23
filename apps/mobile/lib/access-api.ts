import { request } from './api';

export type AccessPass = {
  id: string;
  qrPayload: string;
  expiresAt: string;
  ttlSeconds: number;
};

export type CheckInResult = {
  eventId: string;
  usedAt: string;
  customer: { fullName: string | null; phone: string | null };
  warehouse: { code: string; name: string } | null;
  facility: { code: string; name: string };
  /** The server decides: OUT when the customer was inside this warehouse. */
  direction: 'IN' | 'OUT';
  /** OUT only: when the visit that just ended started. */
  checkedInAt: string | null;
};

export type CheckOutMethod = 'SCAN' | 'MANUAL' | 'AUTO';

/** One stay in a shelf warehouse, from the entry scan to the check-out (null while inside). */
export type Visit = {
  id: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  checkOutMethod: CheckOutMethod | null;
  checkOutNote: string | null;
  customer: { fullName: string | null; phone: string | null };
  warehouse: { id: string; code: string; name: string } | null;
  facility: { code: string; name: string } | null;
};

export type ScanWarehouse = {
  id: string;
  code: string;
  name: string;
  facility: { id: string; code: string; name: string };
};

export const AccessApi = {
  /** The customer's one check-in code, valid at every warehouse where they rent a shelf. */
  createPass: () => request<AccessPass>('/access/passes', { method: 'POST' }),
  checkIn: (qrPayload: string, warehouseId: string) =>
    request<CheckInResult>('/access/check-ins', {
      method: 'POST',
      body: JSON.stringify({ qrPayload, warehouseId }),
    }),
  /** Customers inside the warehouse now, earliest arrival first. */
  inside: (warehouseId: string) =>
    request<Visit[]>(`/access/visits/inside?warehouseId=${encodeURIComponent(warehouseId)}`),
  /** Staff end a visit without the exit scan; the note says why. */
  checkOutManually: (visitId: string, note: string) =>
    request<Visit>(`/access/visits/${encodeURIComponent(visitId)}/check-out`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  /** The customer's current visit, if inside, and their latest visits. */
  myVisits: () => request<{ current: Visit | null; recent: Visit[] }>('/access/visits/mine'),
  /** Shelf warehouses at the facilities the staff member works at: the places a code can open. */
  scanWarehouses: async () => {
    const units = await request<(ScanWarehouse & { kind: string })[]>('/warehouses/mine');
    return units
      .filter((unit) => unit.kind === 'SHELF_WAREHOUSE')
      .map(({ id, code, name, facility }) => ({ id, code, name, facility }));
  },
};
