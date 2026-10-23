import type { ApiResponse, ContractInvoiceRecord, RecordInvoicePaymentInput } from '@storage/types';
import { apiClient } from './api';

const base = (contractId: string) => `/contracts/${contractId}/invoices`;

/** Invoices of a contract; admins, operations managers and managers of its facility. */
export const InvoicesApi = {
  listForContract: async (contractId: string): Promise<ContractInvoiceRecord[]> => {
    const res = await apiClient.get<ApiResponse<ContractInvoiceRecord[]>>(base(contractId));
    return res.data.data;
  },

  /** Money SePay could not match (cash, or a transfer with the wrong content); returns the invoice. */
  recordPayment: async (
    contractId: string,
    invoiceId: string,
    input: RecordInvoicePaymentInput,
  ): Promise<ContractInvoiceRecord> => {
    const res = await apiClient.post<ApiResponse<ContractInvoiceRecord>>(
      `${base(contractId)}/${invoiceId}/payments`,
      input,
    );
    return res.data.data;
  },
};
