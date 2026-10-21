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
  /** Shelf warehouses at the facilities the staff member works at: the places a code can open. */
  scanWarehouses: async () => {
    const units = await request<(ScanWarehouse & { kind: string })[]>('/warehouses/mine');
    return units
      .filter((unit) => unit.kind === 'SHELF_WAREHOUSE')
      .map(({ id, code, name, facility }) => ({ id, code, name, facility }));
  },
};
