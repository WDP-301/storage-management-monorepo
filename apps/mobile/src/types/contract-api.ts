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
};
