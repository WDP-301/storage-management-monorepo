import type { ConfigService } from '@nestjs/config';
import { ENV_KEY } from '@shared/constants';
import Decimal from 'decimal.js';

/**
 * VietQR image URL (img.vietqr.io) — renders a Napas QR that any VN banking app can scan.
 * `bankId` is the bank's acquirer code (e.g. "MB", "VCB" or a BIN like "970422").
 * Template "compact2" renders amount + account info under the QR.
 */
export function buildVietQrUrl(options: {
  bankId: string;
  accountNo: string;
  accountName: string;
  /** Integer VND amount (decimal string ok, must be integer-valued). */
  amount: string | number;
  /** Transfer content — must carry the booking number for webhook matching. */
  addInfo: string;
}): string {
  const params = new URLSearchParams({
    amount: String(options.amount),
    addInfo: options.addInfo,
    accountName: options.accountName,
  });
  return `https://img.vietqr.io/image/${options.bankId}-${options.accountNo}-compact2.png?${params}`;
}

/** True when the SePay receiving account is configured, i.e. a payment QR can be rendered. */
export function paymentQrConfigured(config: ConfigService): boolean {
  return Boolean(
    config.get<string>(ENV_KEY.SEPAY_BANK_ID) &&
      config.get<string>(ENV_KEY.SEPAY_ACCOUNT_NO) &&
      config.get<string>(ENV_KEY.SEPAY_ACCOUNT_NAME),
  );
}

/**
 * QR for a transfer into the SePay receiving account. `addInfo` must carry the reference the
 * webhook matches on (booking or invoice number). Null when the account env is not configured.
 */
export function buildPaymentQrUrl(
  config: ConfigService,
  amount: string | number,
  addInfo: string,
): string | null {
  if (!paymentQrConfigured(config)) return null;
  return buildVietQrUrl({
    bankId: config.get<string>(ENV_KEY.SEPAY_BANK_ID) as string,
    accountNo: config.get<string>(ENV_KEY.SEPAY_ACCOUNT_NO) as string,
    accountName: config.get<string>(ENV_KEY.SEPAY_ACCOUNT_NAME) as string,
    amount: new Decimal(amount).toFixed(0),
    addInfo,
  });
}
