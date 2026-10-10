import type { ApiContract, CustomerContractResponse } from '../src/types/contract-api';
import { request } from './api';
import { normaliseContract } from './contracts-api';

export type StaffContractPermissions = {
  documents: boolean;
  handover: boolean;
  return: boolean;
};

/** Raw `GET /contracts/:id/staff-view`: the customer record plus the customer and permissions. */
export type StaffContractResponse = CustomerContractResponse & {
  customer: { id: string; full_name: string | null; phone: string | null };
  permissions: StaffContractPermissions;
};

export type StaffContract = ApiContract & {
  customer: { id: string; fullName: string; phone: string | null };
  /** Computed by the server; the app only hides or shows editors accordingly. */
  permissions: StaffContractPermissions;
};

export const StaffContractsApi = {
  get: async (id: string, signal?: AbortSignal): Promise<StaffContract> =>
    normaliseStaffContract(
      await request<StaffContractResponse>(`/contracts/${id}/staff-view`, { signal }),
    ),
};

export function normaliseStaffContract(response: StaffContractResponse): StaffContract {
  return {
    ...normaliseContract(response),
    customer: {
      id: response.customer.id,
      fullName: response.customer.full_name || 'Khách hàng',
      phone: response.customer.phone || null,
    },
    // A missing flag means no access, never edit rights.
    permissions: {
      documents: response.permissions?.documents === true,
      handover: response.permissions?.handover === true,
      return: response.permissions?.return === true,
    },
  };
}
