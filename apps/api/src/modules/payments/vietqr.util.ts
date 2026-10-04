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
