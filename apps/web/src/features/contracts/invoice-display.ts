import type { ContractInvoiceRecord, InvoiceKind, PaymentMethod } from '@storage/types';

export const INVOICE_KIND_LABEL: Record<InvoiceKind, string> = {
  INITIAL: 'Tiền thuê',
  RENEWAL: 'Gia hạn',
  SETTLEMENT: 'Quyết toán',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  VNPAY: 'VNPay',
  MOMO: 'MoMo',
  SIMULATED: 'Giả lập',
  DEPOSIT: 'Trừ tiền cọc',
};

type Variant = 'error' | 'success' | 'warning' | 'neutral' | 'primary';

/** Status badge; an unpaid invoice past its due date reads as overdue rather than issued. */
export function invoiceStatusBadge(invoice: ContractInvoiceRecord): {
  label: string;
  variant: Variant;
} {
  if (invoice.is_overdue) return { label: 'Quá hạn', variant: 'error' };
  switch (invoice.status) {
    case 'PAID':
      return { label: 'Đã thanh toán', variant: 'success' };
    case 'PARTIALLY_PAID':
      return { label: 'Thanh toán một phần', variant: 'warning' };
    case 'VOID':
      return { label: 'Đã hủy', variant: 'neutral' };
    case 'DRAFT':
      return { label: 'Nháp', variant: 'neutral' };
    default:
      return { label: 'Chờ thanh toán', variant: 'primary' };
  }
}

/** "Kỳ 2 · Gia hạn" — what the invoice bills. */
export const invoicePeriodLabel = (invoice: ContractInvoiceRecord): string =>
  invoice.kind === 'SETTLEMENT'
    ? INVOICE_KIND_LABEL.SETTLEMENT
    : `Kỳ ${invoice.period_no} · ${INVOICE_KIND_LABEL[invoice.kind]}`;

/**
 * The invoice moved under us: paid or voided meanwhile (409), or someone else's payment left
 * less due than this one (400 on `amount`). The list must be reloaded.
 */
export function isStalePaymentError(err: unknown): boolean {
  const { status, details } = (err ?? {}) as {
    status?: number;
    details?: { fields?: { field?: string; code?: string }[] };
  };
  if (status === 409) return true;
  return (
    status === 400 &&
    !!details?.fields?.some((f) => f.field === 'amount' && f.code === 'exceedsDue')
  );
}
