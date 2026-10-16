import { request } from './api';

export type AccessPass = {
  id: string;
  qrPayload: string;
  expiresAt: string;
  ttlSeconds: number;
  contract: { id: string; contractNo: string };
  unit: { code: string; name: string };
};

export type CheckInResult = {
  eventId: string;
  usedAt: string;
  customer: { fullName: string | null; phone: string | null };
  contract: { id: string; contractNo: string; endedAt: string | null };
  unit: { code: string; name: string };
  warehouse: { code: string; name: string } | null;
  facility: { code: string; name: string };
};

export const AccessApi = {
  createPass: (contractId: string) =>
    request<AccessPass>('/access/passes', {
      method: 'POST',
      body: JSON.stringify({ contractId }),
    }),
  checkIn: (qrPayload: string) =>
    request<CheckInResult>('/access/check-ins', {
      method: 'POST',
      body: JSON.stringify({ qrPayload }),
    }),
};
