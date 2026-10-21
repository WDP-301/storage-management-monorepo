import { findVnBank } from '@storage/types';
import type { RefundBankAccount, RefundBankAccountInput } from '../../types/settlement';

/** Bank choice value for a bank missing from VN_BANKS: typed by name, no BIN. */
export const OTHER_BANK = 'OTHER';

export interface BankFormState {
  /** BIN of a listed bank, OTHER_BANK, or '' while nothing is picked. */
  bankBin: string;
  /** Only used with OTHER_BANK. */
  bankName: string;
  accountNo: string;
  accountName: string;
}

export const EMPTY_BANK_FORM: BankFormState = {
  bankBin: '',
  bankName: '',
  accountNo: '',
  accountName: '',
};

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

export function toBankForm(account: RefundBankAccount | null | undefined): BankFormState {
  if (!account) return EMPTY_BANK_FORM;
  const listed = account.bankBin && findVnBank(account.bankBin);
  return {
    bankBin: listed ? (account.bankBin as string) : OTHER_BANK,
    bankName: listed ? '' : account.bankName,
    accountNo: account.accountNo,
    accountName: account.accountName,
  };
}

/** First problem with the account, in Vietnamese; null when it can be sent. */
export function validateBankForm(form: BankFormState): string | null {
  if (!form.bankBin) return 'Chọn ngân hàng nhận tiền hoàn.';
  if (form.bankBin === OTHER_BANK) {
    const name = form.bankName.trim();
    if (!name) return 'Nhập tên ngân hàng.';
    if (name.length > 100) return 'Tên ngân hàng tối đa 100 ký tự.';
  } else if (!findVnBank(form.bankBin)) {
    return 'Ngân hàng không có trong danh sách.';
  }
  if (!ACCOUNT_NO.test(form.accountNo.trim())) return 'Số tài khoản gồm 4–30 chữ hoặc số.';
  const holder = toAccountHolderName(form.accountName);
  if (holder.length < 2 || holder.length > 100) return 'Tên chủ tài khoản từ 2 đến 100 ký tự.';
  return null;
}

/** Request body form of a valid account; a listed bank is named by the server from its BIN. */
export function toBankAccountInput(form: BankFormState): RefundBankAccountInput {
  const listed = form.bankBin !== OTHER_BANK ? findVnBank(form.bankBin) : undefined;
  return {
    bankBin: listed ? listed.bin : null,
    bankName: listed ? listed.shortName : form.bankName.trim(),
    accountNo: form.accountNo.trim(),
    accountName: toAccountHolderName(form.accountName),
  };
}

/** Whether the form names the same account as `account` (compared the way the server does). */
export function isSameAccount(
  form: BankFormState,
  account: RefundBankAccount | null | undefined,
): boolean {
  if (!account) return false;
  const typed = toBankAccountInput(form);
  const bank = (bin: string | null | undefined, name: string) =>
    bin ?? `name:${name.trim().toLowerCase()}`;
  return (
    bank(typed.bankBin, typed.bankName) === bank(account.bankBin, account.bankName) &&
    typed.accountNo === account.accountNo.trim() &&
    typed.accountName === toAccountHolderName(account.accountName)
  );
}
