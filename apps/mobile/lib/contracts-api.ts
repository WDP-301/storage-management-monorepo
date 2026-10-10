import type {
  ApiContract,
  ApiInspection,
  CustomerContractResponse,
  InspectionSummaryResponse,
} from '../src/types/contract-api';
import { request } from './api';
import { isEvidenceFile, toDamages } from './evidence';

export const ContractsApi = {
  /** Contracts the signed-in customer holds — the "Kho của tôi" source. */
  listMine: async (signal?: AbortSignal): Promise<ApiContract[]> => {
    const contracts = await request<CustomerContractResponse[]>('/contracts/mine', { signal });
    return contracts.map(normaliseContract);
  },

  /** Opens a return request (biên trả) for an active contract. `dayIso` is the local day. */
  requestReturn: (contractId: string, dayIso: string, note?: string) =>
    request<{ id: string }>(`/contracts/${contractId}/return-request`, {
      method: 'POST',
      // Noon UTC keeps the same calendar day in Vietnam, like booking start dates.
      body: JSON.stringify({ scheduledAt: `${dayIso}T12:00:00.000Z`, note: note || undefined }),
    }),
};

export function normaliseContract(contract: CustomerContractResponse): ApiContract {
  return {
    id: contract.id,
    contractNo: contract.contract_no,
    kind: contract.kind,
    status: contract.status,
    effectiveAt: contract.effective_at,
    endedAt: contract.ended_at,
    signedAt: contract.signed_at ?? null,
    months: contract.months,
    monthlyPrice: Number(contract.monthly_price),
    deposit: Number(contract.deposit),
    unit: contract.unit
      ? {
          id: contract.unit.id,
          code: contract.unit.code,
          name: contract.unit.name,
          address: contract.unit.address_line,
          areaM2: Number(contract.unit.area_m2),
          widthM: toOptionalNumber(contract.unit.width_m),
          lengthM: toOptionalNumber(contract.unit.length_m),
          heightM: toOptionalNumber(contract.unit.height_m),
          volumeM3: toOptionalNumber(contract.unit.volume_m3),
          status: contract.unit.status,
        }
      : null,
    facility: contract.facility
      ? {
          id: contract.facility.id,
          code: contract.facility.code,
          name: contract.facility.name,
        }
      : null,
    handover: contract.handover ? normaliseInspection(contract.handover) : null,
    return: contract.return ? normaliseInspection(contract.return) : null,
    documents: (contract.documents ?? []).filter(isEvidenceFile),
  };
}

function toOptionalNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normaliseInspection(inspection: InspectionSummaryResponse): ApiInspection {
  return {
    id: inspection.id,
    scheduledAt: inspection.scheduled_at,
    inspectedAt: inspection.inspected_at,
    finalizedAt: inspection.finalized_at,
    inspectorName: inspection.inspector_name,
    requestNote: inspection.request_note,
    conditionNotes: inspection.condition_notes,
    evidence: (inspection.evidence ?? []).filter(isEvidenceFile),
    damages: toDamages(inspection.damages),
  };
}
