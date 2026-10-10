import type { ContractStatus, DamageSeverity } from '@storage/types';

export type InspectionKind = 'PRE_HANDOVER' | 'RETURN' | 'MAINTENANCE';
export type InspectionListStatus = 'open' | 'done';

/** A file in the private bucket — open it through a presigned download URL. */
export interface EvidenceFile {
  fileKey: string;
  name: string;
  mimeType: string;
  size?: number;
}

export interface InspectionDamage {
  description: string;
  severity: DamageSeverity;
  evidence?: EvidenceFile[];
}

/** `GET /inspections` row — the entity with its contract → unit → facility chain. */
export interface InspectionRecord {
  id: string;
  type: InspectionKind;
  inspectedBy: string | null;
  requestNote?: string | null;
  conditionNotes: string | null;
  evidence: unknown[] | null;
  damages: unknown[] | null;
  scheduledAt: string | null;
  inspectedAt: string | null;
  finalizedAt: string | null;
  createdAt: string;
  inspector?: { id: string; fullName: string } | null;
  contract?: {
    id: string;
    contractNo: string;
    status: ContractStatus;
    effectiveAt: string;
    endedAt: string | null;
    months: number;
    /** Signed-contract files; absent on payloads that predate the field. */
    documents?: unknown[] | null;
    customerSnapshot?: { fullName?: string; phone?: string | null; email?: string } | null;
    bookingItem?: {
      storageUnit?: {
        id: string;
        code: string;
        facilityId: string;
        facility?: { id: string; name: string } | null;
      } | null;
    } | null;
  } | null;
}

export interface ListInspectionsQuery {
  type?: InspectionKind;
  status?: InspectionListStatus;
  facilityId?: string;
}

export interface FacilityStaffMember {
  id: string;
  fullName: string;
  phone: string | null;
}
