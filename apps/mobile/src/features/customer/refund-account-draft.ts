import type { RefundBankAccount, RefundBankAccountInput } from '@storage/types';
import type { VerifiedBankAccount } from '../../../lib/banks-api';

/**
 * The refund account form as filled in. `verified` is the bank's answer for one bank + number; it
 * only counts while the form still shows that same pair (see `verifiedAccount`).
 */
export type RefundAccountDraft = {
  bankBin: string | null;
  /** Short name of the chosen bank, for display. */
  bankName: string;
  accountNo: string;
  verified: VerifiedBankAccount | null;
};

export const EMPTY_REFUND_ACCOUNT: RefundAccountDraft = {
  bankBin: null,
  bankName: '',
  accountNo: '',
  verified: null,
};

const ACCOUNT_NO = /^[0-9A-Za-z]{4,30}$/;

export const compactAccountNo = (value: string) => value.replace(/\s+/g, '');

export function isAccountNoValid(value: string): boolean {
  return ACCOUNT_NO.test(compactAccountNo(value));
}

/**
 * Pre-fills the form from the account used last time. The server verified it when saving, so it
 * counts as verified; one saved before verification existed has no bank BIN and is not offered.
 */
export function draftFromAccount(
  account: RefundBankAccount | null | undefined,
): RefundAccountDraft {
  if (!account || account.bankBin === null) return EMPTY_REFUND_ACCOUNT;
  return {
    bankBin: account.bankBin,
    bankName: account.bankName,
    accountNo: account.accountNo,
    verified: {
      bankBin: account.bankBin,
      bankName: account.bankName,
      accountNo: compactAccountNo(account.accountNo),
      accountName: account.accountName,
    },
  };
}

/** The bank's confirmation, only while it still matches the bank and number in the form. */
export function verifiedAccount(draft: RefundAccountDraft): VerifiedBankAccount | null {
  const { verified } = draft;
  if (!verified) return null;
  const same =
    verified.bankBin === draft.bankBin && verified.accountNo === compactAccountNo(draft.accountNo);
  return same ? verified : null;
}

export function isDraftEmpty(draft: RefundAccountDraft): boolean {
  return draft.bankBin === null && draft.accountNo.trim() === '';
}

/** First problem with the form, worded for the customer; null when it can be sent. */
export function refundAccountProblem(draft: RefundAccountDraft): string | null {
  if (draft.bankBin === null) return 'Chọn ngân hàng nhận hoàn cọc';
  if (!isAccountNoValid(draft.accountNo)) return 'Số tài khoản gồm 4–30 chữ số hoặc chữ cái';
  if (!verifiedAccount(draft)) return 'Kiểm tra tài khoản trước khi gửi';
  return null;
}

/** Request body form; the server verifies the pair again and names the bank and holder itself. */
export function toRefundAccountInput(draft: RefundAccountDraft): RefundBankAccountInput {
  return { bankBin: draft.bankBin ?? '', accountNo: compactAccountNo(draft.accountNo) };
}

export type RefundAccountPayload = {
  /** Set when the form has to be fixed before sending. */
  problem: string | null;
  /** undefined = send no account (none needed, or keep the one already on the request). */
  refundAccount?: RefundBankAccountInput;
};

/**
 * What to send as the refund account. A new request needs one unless there is no deposit to
 * refund. A change to an open request keeps the account already stored on it — which the app
 * never sees — unless the customer filled the form in, so a reschedule cannot overwrite it.
 */
export function refundAccountPayload(
  draft: RefundAccountDraft,
  rule: { isEdit: boolean; required: boolean; touched: boolean },
): RefundAccountPayload {
  const sendNothing = rule.isEdit
    ? !rule.touched || isDraftEmpty(draft)
    : !rule.required && isDraftEmpty(draft);
  if (sendNothing) return { problem: null };
  const problem = refundAccountProblem(draft);
  return problem ? { problem } : { problem: null, refundAccount: toRefundAccountInput(draft) };
}
