import type {
  InspectionListStatus,
  InspectionResponse,
  InspectionUpdate,
  StaffInspection,
} from '../src/types/inspection-api';
import { request } from './api';
import { isEvidenceFile, toDamages } from './evidence';

export const InspectionsApi = {
  /**
   * Staff see what is assigned to them; facility managers see every inspection of the
   * facilities they manage (the API scopes it).
   */
  list: async (
    scope: 'assigned' | 'managed',
    status: InspectionListStatus,
    signal?: AbortSignal,
  ): Promise<StaffInspection[]> => {
    const path = scope === 'assigned' ? '/inspections/assigned' : '/inspections';
    const rows = await request<InspectionResponse[]>(`${path}?status=${status}`, { signal });
    return rows.map(normaliseInspection);
  },

  get: async (id: string, signal?: AbortSignal): Promise<StaffInspection> =>
    normaliseInspection(await request<InspectionResponse>(`/inspections/${id}`, { signal })),

  update: async (id: string, body: Partial<InspectionUpdate>): Promise<StaffInspection> =>
    normaliseInspection(
      await request<InspectionResponse>(`/inspections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    ),

  finalize: (id: string) =>
    request<InspectionResponse>(`/inspections/${id}/finalize`, { method: 'POST' }),
};

export function normaliseInspection(row: InspectionResponse): StaffInspection {
  const unit = row.contract?.bookingItem?.storageUnit;
  return {
    id: row.id,
    type: row.type,
    inspectedBy: row.inspectedBy,
    inspectorName: row.inspector?.fullName ?? null,
    requestNote: row.requestNote ?? null,
    conditionNotes: row.conditionNotes ?? '',
    evidence: (row.evidence ?? []).filter(isEvidenceFile),
    damages: toDamages(row.damages),
    scheduledAt: row.scheduledAt,
    finalizedAt: row.finalizedAt,
    createdAt: row.createdAt,
    unitCode: unit?.code ?? '—',
    facilityName: unit?.facility?.name ?? '',
    customerName: row.contract?.customerSnapshot?.fullName ?? 'Khách hàng',
    customerPhone: row.contract?.customerSnapshot?.phone ?? null,
    contract: row.contract
      ? {
          contractNo: row.contract.contractNo,
          status: row.contract.status,
          effectiveAt: row.contract.effectiveAt,
          endedAt: row.contract.endedAt,
          months: row.contract.months,
        }
      : null,
  };
}
