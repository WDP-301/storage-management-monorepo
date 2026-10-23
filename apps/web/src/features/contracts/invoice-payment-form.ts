import {
  type EvidenceFile,
  ManualPaymentMethod,
  type RecordInvoicePaymentInput,
} from '@storage/types';
import { vnNoonIso, vnToday } from '../../lib/vn-day';

export const MAX_PAYMENT_EVIDENCE = 5;
export const MAX_PAYMENT_NOTE_LENGTH = 1000;
export const MAX_PAYMENT_REF_LENGTH = 100;

export interface InvoicePaymentFormState {
  method: ManualPaymentMethod;
  /** Digits as typed; parsed on submit. */
  amount: string;
  /** Vietnam calendar day the money was received, `YYYY-MM-DD`. */
  paidOn: string;
  transferRef: string;
  evidence: EvidenceFile[];
  note: string;
}

/** Starts on the full amount still due, received today by bank transfer. */
export function initialPaymentForm(amountDue: number, today = vnToday()): InvoicePaymentFormState {
  return {
    method: ManualPaymentMethod.BANK_TRANSFER,
    amount: String(amountDue),
    paidOn: today,
    transferRef: '',
    evidence: [],
    note: '',
  };
}

/** "1.500.000" or "1500000" → 1500000; null when it is not a whole positive number. */
export function parseVndAmount(raw: string): number | null {
  const digits = raw.replace(/[.,\s]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** First problem with the form, mirroring the API's checks; null when it can be sent. */
export function validatePaymentForm(
  state: InvoicePaymentFormState,
  amountDue: number,
  today = vnToday(),
): string | null {
  const amount = parseVndAmount(state.amount);
  if (amount === null) return 'Nhập số tiền là số nguyên dương (VND).';
  if (amount > amountDue) return 'Số tiền vượt quá số còn phải thu.';
  if (!state.paidOn) return 'Chọn ngày nhận tiền.';
  if (state.paidOn > today) return 'Ngày nhận tiền không được ở tương lai.';
  const ref = state.transferRef.trim();
  if (state.method === ManualPaymentMethod.BANK_TRANSFER && !ref && state.evidence.length === 0)
    return 'Nhập mã giao dịch hoặc đính kèm ảnh giao dịch chuyển khoản.';
  if (ref.length > MAX_PAYMENT_REF_LENGTH)
    return `Mã giao dịch tối đa ${MAX_PAYMENT_REF_LENGTH} ký tự.`;
  if (state.evidence.length > MAX_PAYMENT_EVIDENCE)
    return `Tối đa ${MAX_PAYMENT_EVIDENCE} ảnh giao dịch.`;
  const note = state.note.trim();
  if (!note) return 'Nhập ghi chú — ví dụ lý do SePay không tự khớp.';
  if (note.length > MAX_PAYMENT_NOTE_LENGTH)
    return `Ghi chú tối đa ${MAX_PAYMENT_NOTE_LENGTH} ký tự.`;
  return null;
}

/**
 * Today is sent as "now" (omitted) so the server never sees a time later than its clock; an
 * earlier day is pinned to noon in Vietnam so it stays on that day in any timezone.
 */
export function buildPaymentInput(
  state: InvoicePaymentFormState,
  today = vnToday(),
): RecordInvoicePaymentInput {
  const input: RecordInvoicePaymentInput = {
    method: state.method,
    amount: parseVndAmount(state.amount) ?? 0,
    note: state.note.trim(),
  };
  if (state.paidOn !== today) input.paidAt = vnNoonIso(state.paidOn);
  const ref = state.transferRef.trim();
  if (ref) input.transferRef = ref;
  if (state.evidence.length > 0) input.evidence = state.evidence;
  return input;
}
