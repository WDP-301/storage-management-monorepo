import type { RefundBankAccount, RefundBankAccountInput } from '@storage/types';
import { toAccountHolderName } from '../../../lib/settlement-format';

/** The refund account form as typed. `bankBin` null with `isOtherBank` = a bank not listed. */
export type RefundAccountDraft = {
  bankBin: string | null;
  bankName: string;
  isOtherBank: boolean;
  accountNo: string;
  accountName: string;
};

export const EMPTY_REFUND_ACCOUNT: RefundAccountDraft = {
  bankBin: null,
  bankName: '',
  isOtherBank: false,
  accountNo: '',
  accountName: '',
};

const ACCOUNT_NO = /^[0-9A-Za-z]{4,30}$/;

const compactAccountNo = (value: string) => value.replace(/\s+/g, '');

/**
 * Pre-fills the form from the account used last time. A BIN the app no longer lists becomes an
 * "other" bank with the saved name, which the server accepts without a BIN.
 */
export function draftFromAccount(
  account: RefundBankAccount | null | undefined,
  isListedBin: (bin: string) => boolean,
): RefundAccountDraft {
  if (!account) return EMPTY_REFUND_ACCOUNT;
  const listed = account.bankBin !== null && isListedBin(account.bankBin);
  return {
    bankBin: listed ? account.bankBin : null,
    bankName: account.bankName,
    isOtherBank: !listed,
    accountNo: account.accountNo,
    accountName: account.accountName,
  };
}

export function isDraftEmpty(draft: RefundAccountDraft): boolean {
  return (
    draft.bankBin === null &&
    !draft.isOtherBank &&
    draft.accountNo.trim() === '' &&
    draft.accountName.trim() === ''
  );
}

/** First problem with the form, worded for the customer; null when it can be sent. */
export function refundAccountProblem(draft: RefundAccountDraft): string | null {
  if (draft.bankBin === null && !draft.isOtherBank) return 'Chọn ngân hàng nhận hoàn cọc';
  if (draft.bankBin === null && draft.bankName.trim() === '') return 'Nhập tên ngân hàng';
  if (!ACCOUNT_NO.test(compactAccountNo(draft.accountNo))) {
    return 'Số tài khoản gồm 4–30 chữ số hoặc chữ cái';
  }
  const holder = toAccountHolderName(draft.accountName);
  if (holder.length < 2 || holder.length > 100) return 'Nhập tên chủ tài khoản';
  return null;
}

/** Request body form; the server names a listed bank from its BIN. */
export function toRefundAccountInput(draft: RefundAccountDraft): RefundBankAccountInput {
  return {
    bankBin: draft.bankBin,
    bankName: draft.bankName.trim(),
    accountNo: compactAccountNo(draft.accountNo),
    accountName: toAccountHolderName(draft.accountName),
  };
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
