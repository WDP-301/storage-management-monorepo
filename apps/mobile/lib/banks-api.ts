import type { VnBank } from '@storage/types';
import { request } from './api';

/** An account the bank confirmed: `accountName` is the holder as the bank reports it. */
export type VerifiedBankAccount = {
  bankBin: string;
  bankName: string;
  accountNo: string;
  accountName: string;
};

export const BanksApi = {
  /** Banks a refund can go to, sorted by short name. */
  list: () => request<VnBank[]>('/banks'),
  /** Asks the bank who owns the account; fails when the account or bank is not found. */
  verify: (bankBin: string, accountNo: string) =>
    request<VerifiedBankAccount>('/banks/verify', {
      method: 'POST',
      body: JSON.stringify({ bankBin, accountNo }),
    }),
};
