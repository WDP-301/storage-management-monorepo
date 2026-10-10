import type { ContractKind, ContractStatus, PaginationMeta } from '@storage/types';

export type { ContractKind, ContractStatus };

export interface ContractInspectionSummary {
  id: string;
  type: string;
  scheduled_at: string | null;
  inspected_at: string | null;
  finalized_at: string | null;
  inspector_name: string | null;
}

/** Back-office contract row from GET /contracts and GET /contracts/:id. */
export interface ContractRecord {
  id: string;
  contract_no: string;
  kind: ContractKind;
  status: ContractStatus;
  effective_at: string;
  ended_at: string | null;
  signed_at: string | null;
  months: number;
  /** Decimal columns arrive as strings. */
  monthly_price: number | string;
  deposit: number | string;
  unit: { id: string; code: string; name: string; address_line: string } | null;
  facility: { id: string; code: string; name: string } | null;
  customer: { id: string; full_name: string | null; email: string | null; phone: string | null };
  handover: ContractInspectionSummary | null;
  return: ContractInspectionSummary | null;
  evidence: string | null;
  created_at: string;
}

export interface ContractListQuery {
  status?: ContractStatus;
  facilityId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ContractListResponse {
  contracts: ContractRecord[];
  meta: PaginationMeta;
}

/** Writable fields of PATCH /contracts/:id; commercial terms are sealed once signed. */
export interface ContractPatch {
  effectiveAt?: string;
  endedAt?: string;
  months?: number;
  monthlyPriceSnapshot?: number;
}
