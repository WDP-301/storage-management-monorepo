import type { ApiResponse } from '@storage/types';
import type {
  ApproveSettlementInput,
  CompleteRefundInput,
  SettlementDecisionsInput,
  SettlementDetailRecord,
} from '../types/settlement';
import { apiClient } from './api';

const base = (contractId: string) => `/settlements/contracts/${contractId}`;

/** Deposit settlement of an ENDED contract; ADMIN and OPERATIONS_MANAGER only. */
export const SettlementsApi = {
  /** Live preview until approved, then the frozen record; 409 SETTLEMENT_NOT_READY before ENDED. */
  detail: async (contractId: string): Promise<SettlementDetailRecord> => {
    const res = await apiClient.get<ApiResponse<SettlementDetailRecord>>(base(contractId));
    return res.data.data;
  },

  /** Server figures and `version` for these decisions; records nothing. */
  preview: async (
    contractId: string,
    decisions: SettlementDecisionsInput,
  ): Promise<SettlementDetailRecord> => {
    const res = await apiClient.post<ApiResponse<SettlementDetailRecord>>(
      `${base(contractId)}/preview`,
      decisions,
    );
    return res.data.data;
  },

  /** Refused with 409 SETTLEMENT_CHANGED when the figures moved since `expectedVersion`. */
  approve: async (
    contractId: string,
    input: ApproveSettlementInput,
  ): Promise<SettlementDetailRecord> => {
    const res = await apiClient.post<ApiResponse<SettlementDetailRecord>>(
      `${base(contractId)}/approve`,
      input,
    );
    return res.data.data;
  },

  /** Marks the manual refund transfer done; needs evidence or a transfer reference. */
  refundComplete: async (
    contractId: string,
    input: CompleteRefundInput,
  ): Promise<SettlementDetailRecord> => {
    const res = await apiClient.post<ApiResponse<SettlementDetailRecord>>(
      `${base(contractId)}/refund-complete`,
      input,
    );
    return res.data.data;
  },
};
