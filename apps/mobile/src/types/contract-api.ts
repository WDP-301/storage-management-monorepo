import type { ContractKind, ContractStatus, DamageSeverity } from '@storage/types';

/** A file in the private bucket; display it through a presigned download URL. */
export type EvidenceFile = {
  fileKey: string;
  name: string;
  mimeType: string;
  size?: number;
};

export type InspectionDamage = {
  description: string;
  severity: DamageSeverity;
  evidence?: EvidenceFile[];
};

/** Raw inspection summary inside `GET /contracts/mine`. */
export type InspectionSummaryResponse = {
  id: string;
  type: string;
  scheduled_at: string | null;
  inspected_at: string | null;
  finalized_at: string | null;
  inspector_name: string | null;
  request_note: string | null;
  condition_notes: string | null;
  evidence: unknown[];
  damages: unknown[];
};

/** Raw shape of `GET /contracts/mine`. Decimals arrive as strings, dates as ISO timestamps. */
export type CustomerContractResponse = {
  id: string;
  contract_no: string;
  kind: ContractKind;
  status: ContractStatus;
  effective_at: string;
  ended_at: string | null;
  signed_at: string | null;
  months: number;
  monthly_price: string;
  deposit: string;
  unit: {
    id: string;
    code: string;
    area_m2: string;
    width_m: string | null;
    length_m: string | null;
    height_m: string | null;
    volume_m3: string | null;
    status: string;
  } | null;
  facility: { id: string; name: string; address_line: string } | null;
  handover: InspectionSummaryResponse | null;
  return: InspectionSummaryResponse | null;
};

/** Handover receipt (biên nhận) or return record (biên trả). Finalized = signed off by staff. */
export type ApiInspection = {
  id: string;
  scheduledAt: string | null;
  inspectedAt: string | null;
  finalizedAt: string | null;
  inspectorName: string | null;
  /** What the customer wrote when asking for the return. */
  requestNote: string | null;
  conditionNotes: string | null;
  evidence: EvidenceFile[];
  damages: InspectionDamage[];
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
  signedAt: string | null;
  months: number;
  monthlyPrice: number;
  deposit: number;
  unit: {
    id: string;
    code: string;
    areaM2: number;
    widthM: number | null;
    lengthM: number | null;
    heightM: number | null;
    volumeM3: number | null;
    status: string;
  } | null;
  facility: { id: string; name: string; address: string } | null;
  handover: ApiInspection | null;
  /** Latest return request; open (not finalized) while the customer waits to move out. */
  return: ApiInspection | null;
};
