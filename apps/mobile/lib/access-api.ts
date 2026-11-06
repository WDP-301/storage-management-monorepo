import { request } from './api';

export type AccessPass = {
  id: string;
  qrPayload: string;
  expiresAt: string;
  ttlSeconds: number;
};

export const AccessApi = {
  /** The customer's one drop-off / pick-up code, valid at every warehouse where they rent a shelf. */
  createPass: () => request<AccessPass>('/access/passes', { method: 'POST' }),
};
