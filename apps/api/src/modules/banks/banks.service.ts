import { toAccountHolderName } from '@modules/contracts/refund-account.util';
import { Injectable } from '@nestjs/common';
import type { RefundBankAccount, RefundBankAccountInput, VnBank } from '@storage/types';
import { HoldstationClient } from './holdstation.client';

const DIRECTORY_TTL_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class BanksService {
  private directory: { banks: VnBank[]; expiresAt: number } | null = null;
  private loading: Promise<VnBank[]> | null = null;

  constructor(private readonly holdstation: HoldstationClient) {}

  /**
   * The bank directory, cached for a few hours since it rarely changes. An expired copy is served
   * at once while a refresh runs in the background, so an outage never slows the form down; with
   * no copy at all the caller waits for the fetch, and its failure surfaces as 503.
   */
  async listBanks(): Promise<VnBank[]> {
    const cached = this.directory;
    if (cached && cached.expiresAt > Date.now()) return cached.banks;
    this.loading ??= this.refresh().finally(() => {
      this.loading = null;
    });
    if (cached) {
      this.loading.catch(() => undefined);
      return cached.banks;
    }
    return this.loading;
  }

  /**
   * Looks the account up at the bank and returns it as stored: the bank's short name and the holder
   * name the bank reports, never what the client typed. Throws BANK_ACCOUNT_INVALID (400) when the
   * bank or account does not exist and SERVICE_UNAVAILABLE (503) when it cannot be checked.
   */
  async verifyAccount(input: RefundBankAccountInput): Promise<RefundBankAccount> {
    const bankBin = input.bankBin.trim();
    const accountNo = input.accountNo.trim();
    const verified = await this.holdstation.verifyAccount(bankBin, accountNo);
    return {
      bankBin,
      bankName: verified.bank.short_name?.trim() || verified.bank.bank_name.trim(),
      accountNo,
      accountName: toAccountHolderName(verified.account_name),
    };
  }

  private async refresh(): Promise<VnBank[]> {
    const banks = (await this.holdstation.listBanks())
      .filter((bank) => bank.bin_code && bank.short_name)
      .map((bank) => ({ bin: bank.bin_code, shortName: bank.short_name, name: bank.bank_name }))
      .sort((a, b) => a.shortName.localeCompare(b.shortName, 'vi'));
    // An empty answer is a provider fault, not "no banks": keep it out of the cache.
    if (banks.length > 0) this.directory = { banks, expiresAt: Date.now() + DIRECTORY_TTL_MS };
    return banks;
  }
}
