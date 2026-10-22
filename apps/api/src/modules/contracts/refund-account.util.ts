import type { RefundBankAccount } from '@storage/types';
import type { EntityManager } from 'typeorm';

/**
 * An account holder name the way Vietnamese banks print it: no diacritics (đ → D), upper case,
 * single spaces. Also what two names are compared on.
 */
export function toAccountHolderName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'D')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

/**
 * The refund account the customer used last time, to pre-fill the next request. Read with plain
 * SQL: many customers have no profile row, and a soft-deleted profile pre-fills nothing. An
 * account saved without a BIN (before accounts were verified) cannot be re-verified, so it
 * pre-fills nothing either.
 */
export async function loadSavedRefundAccount(
  em: EntityManager,
  userId: string,
): Promise<RefundBankAccount | null> {
  const [row]: { account: Partial<RefundBankAccount> | null }[] = await em.query(
    `SELECT refund_bank_account AS account FROM customer_profiles
      WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  const account = row?.account;
  if (!account || !isText(account.bankName) || !isText(account.accountNo)) return null;
  if (!isText(account.accountName) || !isText(account.bankBin)) return null;
  return {
    bankBin: account.bankBin,
    bankName: account.bankName,
    accountNo: account.accountNo,
    accountName: account.accountName,
  };
}

/**
 * Remembers the account for pre-filling only — the return request keeps its own copy, so a later
 * change here never alters a request already made. Creates the profile row when there is none.
 */
export async function rememberRefundAccount(
  em: EntityManager,
  userId: string,
  account: RefundBankAccount,
): Promise<void> {
  await em.query(
    `INSERT INTO customer_profiles (user_id, refund_bank_account) VALUES ($1, $2::jsonb)
     ON CONFLICT ("user_id") DO UPDATE
       SET refund_bank_account = EXCLUDED.refund_bank_account, updated_at = now()`,
    [userId, JSON.stringify(account)],
  );
}
