import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV_KEY } from '@shared/constants';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';

const TIMEOUT_MS = 10_000;
const PAGE_SIZE = 200;
// Holdstation's business error codes for "this bank / this account does not exist". A wrong
// Partner-App-Key also answers 400501, so a misconfigured key looks like invalid accounts.
const INVALID_BANK = '400500';
const INVALID_ACCOUNT = '400501';

export interface HoldstationBank {
  bin_code: string;
  bank_name: string;
  short_name: string;
}

export interface HoldstationVerifiedAccount {
  bank: { bank_name: string; short_name: string };
  account_name: string;
  account_number: string;
}

export const unavailable = () =>
  new DomainException(
    ErrorCode.SERVICE_UNAVAILABLE,
    'Không kiểm tra được tài khoản ngân hàng lúc này, vui lòng thử lại sau',
    HttpStatus.SERVICE_UNAVAILABLE,
  );

export const invalidAccount = (reason: 'BANK' | 'ACCOUNT') =>
  new DomainException(
    ErrorCode.BANK_ACCOUNT_INVALID,
    reason === 'BANK'
      ? 'Ngân hàng không hợp lệ hoặc chưa được hỗ trợ'
      : 'Số tài khoản không tồn tại tại ngân hàng đã chọn',
    HttpStatus.BAD_REQUEST,
    { reason },
  );

/**
 * Holdstation Pay partner API: bank directory and account-holder lookup. Base URL and partner key
 * come only from the environment; the key is sent as a header and never logged or returned.
 */
@Injectable()
export class HoldstationClient {
  private readonly logger = new Logger(HoldstationClient.name);

  constructor(private readonly config: ConfigService) {}

  async listBanks(): Promise<HoldstationBank[]> {
    const banks: HoldstationBank[] = [];
    for (let page = 1; ; page++) {
      const data = await this.call<{ banks?: HoldstationBank[]; total_count?: number }>(
        `/banks?size=${PAGE_SIZE}&page=${page}`,
        { method: 'GET' },
      );
      const batch = data.banks ?? [];
      banks.push(...batch);
      if (batch.length < PAGE_SIZE || banks.length >= (data.total_count ?? 0)) return banks;
    }
  }

  async verifyAccount(bin: string, accountNo: string): Promise<HoldstationVerifiedAccount> {
    const data = await this.call<HoldstationVerifiedAccount>('/payment-methods/verify', {
      method: 'POST',
      body: JSON.stringify({ account_number: accountNo, bin_code: bin }),
    });
    if (!data?.account_name?.trim()) throw invalidAccount('ACCOUNT');
    return data;
  }

  private settings(): { baseUrl: string; key: string } {
    const baseUrl = this.config.get<string>(ENV_KEY.HOLDSTATION_API_URL)?.trim();
    const key = this.config.get<string>(ENV_KEY.HOLDSTATION_PARTNER_APP_KEY)?.trim();
    if (!baseUrl || !key) {
      this.logger.error('HOLDSTATION_API_URL or HOLDSTATION_PARTNER_APP_KEY is not configured');
      throw unavailable();
    }
    return { baseUrl: baseUrl.replace(/\/+$/, ''), key };
  }

  private async call<T>(path: string, init: RequestInit): Promise<T> {
    const { baseUrl, key } = this.settings();
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: { 'Partner-App-Key': key, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (cause) {
      this.logger.warn(`Holdstation ${path.split('?')[0]} unreachable: ${String(cause)}`);
      throw unavailable();
    }
    const json = (await res.json().catch(() => null)) as {
      data?: T;
      error_code?: string;
      message?: string;
    } | null;
    if (res.ok && json?.data) return json.data;

    const code = json?.error_code;
    if (res.status === 400 && (code === INVALID_BANK || code === INVALID_ACCOUNT)) {
      // Logged because a wrong partner key produces exactly this answer for every account.
      this.logger.warn(`Holdstation ${path.split('?')[0]} rejected the account: ${code}`);
      throw invalidAccount(code === INVALID_BANK ? 'BANK' : 'ACCOUNT');
    }
    this.logger.warn(
      `Holdstation ${path.split('?')[0]} failed: HTTP ${res.status} ${code ?? ''} ${json?.message ?? ''}`,
    );
    throw unavailable();
  }
}
