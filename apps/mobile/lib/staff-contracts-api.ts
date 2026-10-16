import type { ApiContract, CustomerContractResponse } from '../src/types/contract-api';
import { request } from './api';
import { normaliseContract } from './contracts-api';

export type StaffContractPermissions = {
  documents: boolean;
  handover: boolean;
  return: boolean;
  firstRent: boolean;
};

export type FirstRent = {
  invoiceId: string;
  invoiceNo: string;
  status: string;
  total: number;
  paidAmount: number;
  amountDue: number;
  paidAt: string | null;
  method: string | null;
  paymentQrUrl: string | null;
};

export type FirstRentResponse = {
  invoice_id: string;
  invoice_no: string;
  status: string;
  total: number | string;
  paid_amount: number | string;
  amount_due: number | string;
  paid_at: string | null;
  method: string | null;
  payment_qr_url: string | null;
};

export function normaliseFirstRent(row: FirstRentResponse): FirstRent {
  return {
    invoiceId: row.invoice_id,
    invoiceNo: row.invoice_no,
    status: row.status,
    total: Number(row.total),
    paidAmount: Number(row.paid_amount),
    amountDue: Number(row.amount_due),
    paidAt: row.paid_at,
    method: row.method,
    paymentQrUrl: row.payment_qr_url,
  };
}

/** Raw `GET /contracts/:id/staff-view`: the customer record plus the customer and permissions. */
export type StaffContractResponse = CustomerContractResponse & {
  customer: { id: string; full_name: string | null; phone: string | null };
  permissions: { documents: boolean; handover: boolean; return: boolean; first_rent: boolean };
  first_rent: FirstRentResponse | null;
};

export type StaffContract = ApiContract & {
  customer: { id: string; fullName: string; phone: string | null };
  /** Computed by the server; the app only hides or shows editors accordingly. */
  permissions: StaffContractPermissions;
  firstRent: FirstRent | null;
};

export const StaffContractsApi = {
  get: async (id: string, signal?: AbortSignal): Promise<StaffContract> =>
    normaliseStaffContract(
      await request<StaffContractResponse>(`/contracts/${id}/staff-view`, { signal }),
    ),
  issueFirstRent: async (id: string): Promise<FirstRent> =>
    normaliseFirstRent(
      await request<FirstRentResponse>(`/contracts/${id}/first-rent`, { method: 'POST' }),
    ),
  confirmFirstRentCash: async (id: string): Promise<FirstRent> =>
    normaliseFirstRent(
      await request<FirstRentResponse>(`/contracts/${id}/first-rent/cash`, { method: 'POST' }),
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
      firstRent: response.permissions?.first_rent === true,
    },
    firstRent: response.first_rent ? normaliseFirstRent(response.first_rent) : null,
  };
}
