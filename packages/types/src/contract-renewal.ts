import type { ContractRenewalStatus } from './domain.enums';
import type { PaginationMeta } from './index';

/** A customer's request to extend an ACTIVE contract by `months` at its current monthly price. */
export interface ContractRenewalView {
  id: string;
  contract_id: string;
  contract_no: string;
  unit_code: string | null;
  facility_id: string | null;
  facility_name: string | null;
  customer: { id: string; full_name: string; phone: string | null } | null;
  /** Months added when approved. */
  months: number;
  /** The contract term the request extends: the current one while pending, the one replaced after. */
  term_months: number;
  term_end_at: string;
  /** Where the term ends once this request is (or was) approved. */
  new_term_end_at: string;
  monthly_price: number;
  status: ContractRenewalStatus;
  note: string | null;
  decision_note: string | null;
  decided_at: string | null;
  decided_by_name: string | null;
  created_at: string;
}

export interface ContractRenewalListResponse {
  items: ContractRenewalView[];
  meta: PaginationMeta;
}

export interface CreateContractRenewalInput {
  contractId: string;
  months: number;
  note?: string;
}
