import type { SepayTransferOutcome } from '@storage/types';
import { apiClient } from './api';

export interface SepayTransferRecord {
  id: string;
  sepay_id: string;
  amount: number;
  content: string | null;
  reference_code: string | null;
  gateway: string | null;
  transaction_date: string | null;
  outcome: SepayTransferOutcome;
  booking_id: string | null;
  invoice_id: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
}

export interface SepayTransferListResponse {
  transfers: SepayTransferRecord[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface SepayAssignResult {
  outcome: string;
  message: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

const unwrap = <T>(res: { data: ApiEnvelope<T> | T }): T =>
  res.data && typeof res.data === 'object' && 'data' in res.data ? res.data.data : res.data;

export const SepayTransfersApi = {
  /** The reconciliation queue — attention outcomes by default, everything with attention=false. */
  list: async (params?: {
    page?: number;
    limit?: number;
    attention?: boolean;
  }): Promise<SepayTransferListResponse> => {
    const res = await apiClient.get<ApiEnvelope<SepayTransferListResponse>>(
      '/payments/sepay-transfers',
      {
        params: {
          page: params?.page,
          limit: params?.limit,
          attention: params?.attention === false ? 'false' : undefined,
        },
      },
    );
    return unwrap(res);
  },

  /** Attach a queued transfer to a booking by its number, replaying the deposit path. */
  assign: async (id: string, bookingNo: string, note?: string): Promise<SepayAssignResult> => {
    const res = await apiClient.post<ApiEnvelope<SepayAssignResult>>(
      `/payments/sepay-transfers/${id}/assign`,
      { bookingNo: bookingNo.trim(), ...(note?.trim() ? { note: note.trim() } : {}) },
    );
    return unwrap(res);
  },

  /** Close a queued transfer with a written explanation of how it was handled. */
  resolve: async (id: string, note: string): Promise<{ outcome: string }> => {
    const res = await apiClient.post<ApiEnvelope<{ outcome: string }>>(
      `/payments/sepay-transfers/${id}/resolve`,
      { note: note.trim() },
    );
    return unwrap(res);
  },
};
