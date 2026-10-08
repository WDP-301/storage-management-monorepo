import type {
  ApiContract,
  ApiInspection,
  CustomerContractResponse,
  EvidenceFile,
  InspectionDamage,
  InspectionSummaryResponse,
} from '../src/types/contract-api';
import { request } from './api';

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

function normaliseContract(contract: CustomerContractResponse): ApiContract {
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
          areaM2: Number(contract.unit.area_m2),
          status: contract.unit.status,
          typeName: contract.unit.type_name,
        }
      : null,
    facility: contract.facility
      ? {
          id: contract.facility.id,
          name: contract.facility.name,
          address: contract.facility.address_line,
        }
      : null,
    handover: contract.handover ? normaliseInspection(contract.handover) : null,
    return: contract.return ? normaliseInspection(contract.return) : null,
  };
}

function normaliseInspection(inspection: InspectionSummaryResponse): ApiInspection {
  return {
    id: inspection.id,
    scheduledAt: inspection.scheduled_at,
    inspectedAt: inspection.inspected_at,
    finalizedAt: inspection.finalized_at,
    inspectorName: inspection.inspector_name,
    conditionNotes: inspection.condition_notes,
    evidence: (inspection.evidence ?? []).filter(isEvidenceFile),
    damages: (inspection.damages ?? []).filter(isDamage).map((damage) => ({
      ...damage,
      evidence: (damage.evidence ?? []).filter(isEvidenceFile),
    })),
  };
}

/** Older rows stored bare URLs; only `{ fileKey }` entries can be presigned and shown. */
function isEvidenceFile(value: unknown): value is EvidenceFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as EvidenceFile).fileKey === 'string'
  );
}

function isDamage(value: unknown): value is InspectionDamage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as InspectionDamage).description === 'string'
  );
}
