import type { ReturnRequestSource } from './domain.enums';

// Conventions: money is whole VND as a number; `*_day` is a Vietnam calendar day `YYYY-MM-DD`;
// `*_at` is an instant. Records are snake_case, request bodies camelCase.

/** Where the customer wants the deposit refunded; frozen on the return request. */
export interface RefundBankAccount {
  /** BIN from the bank directory; null only on accounts saved before verification existed. */
  bankBin: string | null;
  bankName: string;
  accountNo: string;
  /** Account holder as the bank returns it: upper case, no diacritics. */
  accountName: string;
}

/**
 * Request body form. The API looks the account up at the bank and stores the bank's own bank
 * name and holder name, so only the BIN and number are needed.
 */
export interface RefundBankAccountInput {
  bankBin: string;
  accountNo: string;
}

/** What the customer sees of a refund account: only the last digits of the number. */
export interface MaskedRefundBankAccount {
  bank_name: string;
  account_no_masked: string;
  account_name: string;
}

/** The return rules in force when the request was made; later setting changes do not apply. */
export interface ReturnRules {
  noticeDays: number;
  penaltyPercent: number;
}

/** A file already uploaded under `uploads/` (same shape as inspection evidence). */
export interface EvidenceFile {
  fileKey: string;
  name: string;
  mimeType: string;
  size?: number;
}

export interface ReturnTimingRecord {
  /** 00:00 Vietnam time of the first day after the term (exclusive end). */
  term_end_at: string | Date;
  last_day: string;
  scheduled_day: string;
  /** Day money is counted to: the later of the actual return day and the scheduled day. */
  effective_return_day: string;
  /** Since when the notice runs; moved to "now" when the return is brought forward. */
  notice_from: string | Date;
  notice_days: number;
  required_notice_days: number;
  early: boolean;
  short_notice: boolean;
  short_notice_deduction: number;
  overstay_from_day: string;
  overstay_days: number;
  overstay_penalty_per_day: number;
  overstay_penalty: number;
}

export interface ReturnPreviewRecord extends ReturnTimingRecord {
  /** Deposit held for the contract; null when it cannot be determined. */
  deposit_held: number | null;
  /** Account the customer used last time, to pre-fill the form. */
  saved_refund_account: RefundBankAccount | null;
}

/** Body of a customer's return request (create). */
export interface ReturnRequestInput {
  scheduledAt: string;
  note?: string;
  refundAccount?: RefundBankAccountInput;
}

/** Body of a customer's return request change; omitted fields stay as they are. */
export type UpdateReturnRequestInput = Partial<ReturnRequestInput>;

/** Body of a return request the branch creates on the customer's behalf. */
export interface ManagedReturnRequestInput extends ReturnRequestInput {
  source: Exclude<ReturnRequestSource, 'CUSTOMER'>;
}
