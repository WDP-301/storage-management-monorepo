import type { ApiResponse, VnBank } from '@storage/types';
import { apiClient } from './api';

/** What the bank reports for an account; `accountName` is upper case without diacritics. */
export interface VerifiedBankAccount {
  bankBin: string;
  bankName: string;
  accountNo: string;
  accountName: string;
}

export const BanksApi = {
  /** Banks that can receive transfers, sorted by short name; 503 when the provider is down. */
  list: async (): Promise<VnBank[]> => {
    const res = await apiClient.get<ApiResponse<VnBank[]>>('/banks');
    return res.data.data;
  },

  /** Looks the account up at the bank; 400 BANK_ACCOUNT_INVALID, 429 when throttled, 503. */
  verify: async (bankBin: string, accountNo: string): Promise<VerifiedBankAccount> => {
    const res = await apiClient.post<ApiResponse<VerifiedBankAccount>>('/banks/verify', {
      bankBin,
      accountNo,
    });
    return res.data.data;
  },
};
