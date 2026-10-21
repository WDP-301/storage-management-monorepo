import type { ApiInvoice, InvoiceResponse, InvoicesPageResponse } from '../src/types/invoice-api';
import { request } from './api';

/** The API caps a page at 50; a contract has at most one invoice per month of its term. */
const CONTRACT_INVOICES_LIMIT = 50;

export const InvoicesApi = {
  /** Invoices of one of the customer's contracts, newest first. */
  listForContract: async (contractId: string, signal?: AbortSignal): Promise<ApiInvoice[]> => {
    const page = await request<InvoicesPageResponse>(
      `/invoices/my?contractId=${encodeURIComponent(contractId)}&limit=${CONTRACT_INVOICES_LIMIT}`,
      { signal },
    );
    const items = Array.isArray(page?.items) ? page.items : [];
    // An API that ignores the filter would list every contract's invoices; keep only this one's.
    return items
      .filter((item) => item.contractId == null || item.contractId === contractId)
      .map(normaliseInvoice);
  },
};

export function normaliseInvoice(row: InvoiceResponse): ApiInvoice {
  return {
    id: row.id,
    invoiceNo: row.invoiceNo,
    kind: row.kind,
    periodNo: Number(row.periodNo) || 1,
    startAt: row.startAt ?? null,
    dueAt: row.dueAt ?? null,
    status: row.status,
    total: toAmount(row.total),
    paidAmount: toAmount(row.paidAmount),
    amountDue: toAmount(row.amountDue),
    paymentQrUrl: row.paymentQrUrl || null,
  };
}

function toAmount(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
