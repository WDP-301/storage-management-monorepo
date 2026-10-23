import type { InvoiceKind, InvoiceStatus, PaymentMethod } from './domain.enums';
import type { EvidenceFile } from './return-request';

/** Methods back-office staff may record by hand; webhook transfers are recorded automatically. */
export const ManualPaymentMethod = {
  CASH: 'CASH',
  BANK_TRANSFER: 'BANK_TRANSFER',
} as const satisfies Record<string, PaymentMethod>;
export type ManualPaymentMethod = (typeof ManualPaymentMethod)[keyof typeof ManualPaymentMethod];

/** One payment applied to an invoice, as shown in the back office. */
export interface InvoicePaymentRecord {
  id: string;
  payment_no: string;
  method: PaymentMethod;
  amount: number;
  paid_at: string | Date | null;
  /** True when recorded by hand rather than matched from a SePay transfer. */
  is_manual: boolean;
  /** Bank reference of the transfer (typed in, or from SePay); SePay's own id when it sent none. */
  transfer_ref: string | null;
  evidence: EvidenceFile[];
  note: string | null;
  /** Who recorded a manual payment; null for webhook payments. */
  recorded_by: { id: string; full_name: string | null } | null;
}

/** An invoice of a contract with what is paid and still due. */
export interface ContractInvoiceRecord {
  id: string;
  invoice_no: string;
  kind: InvoiceKind;
  period_no: number;
  status: InvoiceStatus;
  start_at: string | Date | null;
  end_at: string | Date | null;
  due_at: string | Date | null;
  issued_at: string | Date | null;
  total: number;
  paid_amount: number;
  amount_due: number;
  is_overdue: boolean;
  payments: InvoicePaymentRecord[];
}

/**
 * A payment received outside SePay matching — cash, or a transfer whose content did not carry
 * the invoice number. A transfer needs proof: its bank reference, evidence files, or both.
 */
export interface RecordInvoicePaymentInput {
  method: ManualPaymentMethod;
  /** Whole VND, at most the amount still due rounded up. */
  amount: number;
  /** When the money was received; defaults to now, never in the future. */
  paidAt?: string;
  transferRef?: string;
  evidence?: EvidenceFile[];
  note: string;
}
