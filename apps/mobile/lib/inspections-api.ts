import type {
  InspectionListStatus,
  InspectionResponse,
  InspectionUpdate,
  StaffInspection,
} from '../src/types/inspection-api';
import { request } from './api';
import { isEvidenceFile, toStaffDamages } from './evidence';

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

  update: (id: string, body: Partial<InspectionUpdate>): Promise<StaffInspection> =>
    patchInspection(id, body),

  /** Moves a return appointment; noon UTC keeps the Vietnam day equal to `dayIso`. */
  reschedule: (id: string, dayIso: string): Promise<StaffInspection> =>
    patchInspection(id, { scheduledAt: `${dayIso}T12:00:00.000Z` }),

  /** `returnedOn` (Vietnam day) is for returns only; without it the API uses today. */
  finalize: (id: string, returnedOn?: string) =>
    request<InspectionResponse>(`/inspections/${id}/finalize`, {
      method: 'POST',
      body: returnedOn ? JSON.stringify({ returnedOn }) : undefined,
    }),
};

async function patchInspection(
  id: string,
  body: Partial<InspectionUpdate> | { scheduledAt: string },
): Promise<StaffInspection> {
  return normaliseInspection(
    await request<InspectionResponse>(`/inspections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  );
}

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
    damages: toStaffDamages(row.damages),
    scheduledAt: row.scheduledAt,
    finalizedAt: row.finalizedAt,
    returnedOn: row.returnedOn ?? null,
    requestSource: row.requestSource ?? null,
    createdAt: row.createdAt,
    unitCode: unit?.code ?? '—',
    facilityName: unit?.facility?.name ?? '',
    customerName: row.contract?.customerSnapshot?.fullName ?? 'Khách hàng',
    customerPhone: row.contract?.customerSnapshot?.phone ?? null,
    contract: row.contract
      ? {
          id: row.contract.id,
          contractNo: row.contract.contractNo,
          status: row.contract.status,
          effectiveAt: row.contract.effectiveAt,
          endedAt: row.contract.endedAt,
          months: row.contract.months,
        }
      : null,
  };
}
