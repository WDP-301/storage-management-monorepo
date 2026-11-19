import type { ContractRenewalView } from '@storage/types';

/** How long a rejection stays on the contract screen, so the customer sees why. */
const REJECTION_SHOWN_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * The renewal worth showing on a contract: the request still waiting for the branch, else a
 * recent rejection newer than any approval. Approved and withdrawn requests need no card — the
 * contract's own term already shows the outcome.
 */
export function renewalToShow(
  renewals: readonly ContractRenewalView[],
  contractId: string,
  now: number,
): ContractRenewalView | null {
  const mine = renewals
    .filter((renewal) => renewal.contract_id === contractId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const pending = mine.find((renewal) => renewal.status === 'PENDING');
  if (pending) return pending;
  const latest = mine.find((renewal) => renewal.status !== 'CANCELLED');
  if (latest?.status !== 'REJECTED' || !latest.decided_at) return null;
  return now - Date.parse(latest.decided_at) <= REJECTION_SHOWN_MS ? latest : null;
}

/**
 * Whether the customer may ask to renew today: ACTIVE, before the term end day (Vietnam days,
 * `YYYY-MM-DD`), and nothing else open on the contract. The server checks again.
 */
export function canRequestRenewal(input: {
  isActive: boolean;
  todayIso: string;
  termEndDayIso: string | null;
  hasOpenReturn: boolean;
  hasOpenChange: boolean;
  hasPendingRenewal: boolean;
}): boolean {
  return (
    input.isActive &&
    input.termEndDayIso !== null &&
    input.todayIso < input.termEndDayIso &&
    !input.hasOpenReturn &&
    !input.hasOpenChange &&
    !input.hasPendingRenewal
  );
}
