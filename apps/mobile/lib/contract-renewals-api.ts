import type { ContractRenewalView } from '@storage/types';
import { request } from './api';

export const ContractRenewalsApi = {
  /** The caller's renewal requests across their contracts, newest first. */
  listMine: (signal?: AbortSignal) =>
    request<ContractRenewalView[]>('/contract-renewals/mine', { signal }),

  /** Asks the branch to extend the contract by `months` at its current price. */
  create: (input: { contractId: string; months: number; note?: string }) =>
    request<ContractRenewalView>('/contract-renewals', {
      method: 'POST',
      body: JSON.stringify({
        contractId: input.contractId,
        months: input.months,
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      }),
    }),

  /** Withdraws a request the branch has not decided yet. */
  cancel: (id: string) =>
    request<ContractRenewalView>(`/contract-renewals/${id}/cancel`, { method: 'POST' }),
};
