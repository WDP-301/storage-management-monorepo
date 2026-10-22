import type { ApiError } from '../../lib/api';
import type { VerifiedBankAccount } from '../../lib/banks-api';
import type { RefundBankAccount, RefundBankAccountInput } from '../../types/settlement';

export interface BankFormState {
  /** BIN of the picked bank, '' while nothing is picked. */
  bankBin: string;
  accountNo: string;
  /** What the bank reported for exactly this bank and number; null until verified. */
  verified: VerifiedBankAccount | null;
}

export const EMPTY_BANK_FORM: BankFormState = { bankBin: '', accountNo: '', verified: null };

const ACCOUNT_NO = /^[0-9A-Za-z]{4,30}$/;

/** Holder name the way banks print it: no diacritics (đ → D), upper case, single spaces. */
export function toAccountHolderName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'D')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pre-fills a stored account; it still has to be verified. Legacy accounts have no BIN. */
export function toBankForm(account: RefundBankAccount | null | undefined): BankFormState {
  if (!account?.bankBin) return EMPTY_BANK_FORM;
  return { bankBin: account.bankBin, accountNo: account.accountNo, verified: null };
}

/** The bank's answer, only while it still matches the bank and number in the form. */
export function currentVerification(form: BankFormState): VerifiedBankAccount | null {
  const { verified } = form;
  return verified &&
    verified.bankBin === form.bankBin &&
    verified.accountNo === form.accountNo.trim()
    ? verified
    : null;
}

/** First problem with the account, in Vietnamese; null when it can be sent. */
export function validateBankForm(form: BankFormState): string | null {
  if (!form.bankBin) return 'Chọn ngân hàng nhận tiền hoàn.';
  if (!ACCOUNT_NO.test(form.accountNo.trim())) return 'Số tài khoản gồm 4–30 chữ hoặc số.';
  if (!currentVerification(form)) return 'Kiểm tra tài khoản ngân hàng trước khi gửi.';
  return null;
}

/** Request body form of a verified account; the server verifies again and names the bank. */
export function toBankAccountInput(form: BankFormState): RefundBankAccountInput {
  return { bankBin: form.bankBin, accountNo: form.accountNo.trim() };
}

/** Whether the verified account is the one `account` stores (same BIN and number). */
export function isSameAccount(
  form: BankFormState,
  account: RefundBankAccount | null | undefined,
): boolean {
  const verified = currentVerification(form);
  if (!verified || !account?.bankBin) return false;
  // The holder name is not compared: the bank supplies it, older accounts carry a typed one, and
  // staff confirm identity in person.
  return verified.bankBin === account.bankBin && verified.accountNo === account.accountNo.trim();
}

/** Vietnamese reason a bank lookup or the bank list failed. */
export function describeBankLookupError(err: unknown): string {
  const { status, code, details } = (err ?? {}) as Partial<ApiError>;
  if (status === 429) return 'Kiểm tra quá nhiều lần, vui lòng thử lại sau ít phút';
  if (code === 'BANK_ACCOUNT_INVALID') {
    return details?.reason === 'BANK'
      ? 'Ngân hàng không hợp lệ hoặc chưa được hỗ trợ'
      : 'Số tài khoản không tồn tại tại ngân hàng đã chọn';
  }
  return 'Không kiểm tra được tài khoản lúc này, vui lòng thử lại';
}
