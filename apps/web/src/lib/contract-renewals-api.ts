import type {
  ContractRenewalListResponse,
  ContractRenewalStatus,
  ContractRenewalView,
} from '@storage/types';
import { apiClient } from './api';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export const ContractRenewalsApi = {
  /** Newest first; a facility manager only gets the facilities they manage. */
  list: async (params: {
    status?: ContractRenewalStatus;
    page?: number;
    limit?: number;
  }): Promise<ContractRenewalListResponse> => {
    const res = await apiClient.get<ApiEnvelope<ContractRenewalListResponse>>(
      '/contract-renewals',
      { params },
    );
    return res.data.data;
  },

  approve: async (id: string, note?: string): Promise<ContractRenewalView> => {
    const res = await apiClient.post<ApiEnvelope<ContractRenewalView>>(
      `/contract-renewals/${id}/approve`,
      note?.trim() ? { note: note.trim() } : {},
    );
    return res.data.data;
  },

  reject: async (id: string, reason: string): Promise<ContractRenewalView> => {
    const res = await apiClient.post<ApiEnvelope<ContractRenewalView>>(
      `/contract-renewals/${id}/reject`,
      { reason: reason.trim() },
    );
    return res.data.data;
  },
};
