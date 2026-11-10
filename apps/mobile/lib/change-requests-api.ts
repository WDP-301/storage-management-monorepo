import { request } from './api';

/** Statuses that still occupy the contract's open-request slot — mirrors UQ_open_change_request. */
export const CHANGE_REQUEST_OPEN_STATUSES = [
  'REQUESTED',
  'PROPOSED',
  'APPROVED',
  'TRANSITIONING',
] as const;

export type ChangeRequestStatus =
  | (typeof CHANGE_REQUEST_OPEN_STATUSES)[number]
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export type ChangeRequestUnitRef = {
  id: string;
  code: string;
  facility_id: string;
};

export type UnitChangeRequest = {
  id: string;
  contract_id: string;
  status: ChangeRequestStatus;
  reason: string;
  old_unit: ChangeRequestUnitRef | null;
  new_unit: (ChangeRequestUnitRef & { monthly_price?: string }) | null;
  move_at: string | null;
  transition_start_at: string | null;
  transition_end_at: string | null;
  topup_invoice_id: string | null;
  decision_note: string | null;
  rent_difference: string | number | null;
  deposit_difference: string | number | null;
  created_at: string;
};

export type UnitChangeOption = {
  unit: {
    id: string;
    code: string;
    name: string;
    facility_id: string;
    facility_name: string;
    monthly_price: number;
    area_m2: number | null;
  };
  rent_difference: number;
  deposit_difference: number;
};

type ListResponse = {
  requests: UnitChangeRequest[];
};

type OptionsResponse = {
  options: UnitChangeOption[];
};

// Noon UTC keeps the same calendar day in Vietnam, like booking/return dates.
const toMoveAt = (dayIso: string) => `${dayIso}T12:00:00.000Z`;

export const ChangeRequestsApi = {
  /** Units the contract could move to, each with its rent/deposit delta. */
  options: (contractId: string, signal?: AbortSignal) =>
    request<OptionsResponse>(
      `/unit-change-requests/options?contractId=${encodeURIComponent(contractId)}`,
      { signal },
    ).then((r) => r.options),

  /** The caller's own requests — the open one (if any) drives the status card. */
  listMine: (signal?: AbortSignal) =>
    request<ListResponse>('/unit-change-requests', { signal }).then((r) => r.requests),

  /** Asks to move the contract to another unit on `dayIso` (local day). */
  create: (input: { contractId: string; newUnitId: string; reason: string; dayIso: string }) =>
    request<{ request: UnitChangeRequest }>('/unit-change-requests', {
      method: 'POST',
      body: JSON.stringify({
        contractId: input.contractId,
        newUnitId: input.newUnitId,
        reason: input.reason,
        scheduledMoveAt: toMoveAt(input.dayIso),
      }),
    }).then((r) => r.request),

  /** Withdraws the request while it still awaits a decision. */
  cancel: (id: string) =>
    request<{ request: UnitChangeRequest }>(`/unit-change-requests/${id}/cancel`, {
      method: 'POST',
    }).then((r) => r.request),
};

/** The request currently blocking a new one, if any. */
export function openChangeRequest(requests: UnitChangeRequest[]): UnitChangeRequest | null {
  return requests.find((r) => CHANGE_REQUEST_OPEN_STATUSES.includes(r.status as never)) ?? null;
}
