import type { ContractKind, ContractStatus } from '@storage/types';

/** Raw shape of `GET /contracts/mine`. Decimals arrive as strings, dates as ISO timestamps. */
export type CustomerContractResponse = {
  id: string;
  contract_no: string;
  kind: ContractKind;
  status: ContractStatus;
  effective_at: string;
  ended_at: string | null;
  months: number;
  monthly_price: string;
  deposit: string;
  unit: {
    id: string;
    code: string;
    area_m2: string;
    status: string;
    type_name: string | null;
  } | null;
  facility: { id: string; name: string; address_line: string } | null;
  handover: {
    id: string;
    inspected_at: string | null;
    finalized_at: string | null;
    inspector_name: string | null;
    condition_notes: string | null;
    damages: unknown[];
  } | null;
};

/** Handover receipt (biên nhận) — signed off once the customer received the unit. */
export type ApiHandover = {
  id: string;
  inspectedAt: string | null;
  finalizedAt: string | null;
  inspectorName: string | null;
  conditionNotes: string | null;
  damageCount: number;
};

/** Normalised contract the app renders. */
export type ApiContract = {
  id: string;
  contractNo: string;
  kind: ContractKind;
  status: ContractStatus;
  effectiveAt: string;
  /** Move-out date; null while the lease runs to `effectiveAt + months`. */
  endedAt: string | null;
  months: number;
  monthlyPrice: number;
  deposit: number;
  unit: {
    id: string;
    code: string;
    areaM2: number;
    status: string;
    typeName: string | null;
  } | null;
  facility: { id: string; name: string; address: string } | null;
  handover: ApiHandover | null;
};
