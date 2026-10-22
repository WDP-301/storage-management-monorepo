/**
 * A bank or e-wallet that can receive transfers, as listed by the bank directory the API proxies
 * (GET /banks). Refund accounts are verified against the same directory.
 */
export interface VnBank {
  /** 6-digit NAPAS BIN — what a transfer identifies the bank by. */
  bin: string;
  /** Brand customers recognise, e.g. "Vietcombank". */
  shortName: string;
  /** Registered legal name. */
  name: string;
}
