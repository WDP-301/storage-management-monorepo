import type { InvoiceKind, InvoiceStatus } from '@storage/types';

/** Raw row of `GET /invoices/my`. Decimals may arrive as strings, dates as ISO timestamps. */
export type InvoiceResponse = {
  id: string;
  invoiceNo: string;
  contractId?: string | null;
  kind: InvoiceKind;
  periodNo: number;
  startAt: string | null;
  dueAt: string | null;
  status: InvoiceStatus;
  total: string | number;
  paidAmount: string | number;
  amountDue: string | number;
  paymentQrUrl: string | null;
};

export type InvoicesPageResponse = {
  items: InvoiceResponse[];
  total: number;
  page: number;
  limit: number;
};

/** Normalised invoice the app renders. */
export type ApiInvoice = {
  id: string;
  invoiceNo: string;
  kind: InvoiceKind;
  /** Rental period number; 1 for the first month. */
  periodNo: number;
  /** Start of the billed period; null for a settlement invoice. */
  startAt: string | null;
  dueAt: string | null;
  status: InvoiceStatus;
  total: number;
  paidAmount: number;
  /** What is still to pay, deposit offsets included. */
  amountDue: number;
  /** VietQR for `amountDue`; null when nothing is due. */
  paymentQrUrl: string | null;
};
