import type { ContractStatus, ReturnRequestSource } from '@storage/types';
import type { EvidenceFile, InspectionDamage } from './contract-api';

export type InspectionKind = 'PRE_HANDOVER' | 'RETURN' | 'MAINTENANCE';

/** A damage as staff see it: the customer-facing fields plus the fee staff propose (whole VND). */
export type StaffDamage = InspectionDamage & { proposedFee: number | null };

/** Raw inspection entity from `/inspections*` — camelCase, nested relations. */
export type InspectionResponse = {
  id: string;
  type: InspectionKind;
  inspectedBy: string | null;
  requestNote: string | null;
  conditionNotes: string | null;
  evidence: unknown[] | null;
  damages: unknown[] | null;
  scheduledAt: string | null;
  inspectedAt: string | null;
  finalizedAt: string | null;
  /** Return only: Vietnam day (`YYYY-MM-DD`) the unit actually came back; set when finalized. */
  returnedOn?: string | null;
  /** Return only: who asked for it. Absent on rows created before the field existed. */
  requestSource?: ReturnRequestSource | null;
  createdAt: string;
  inspector?: { fullName: string } | null;
  contract?: {
    id: string;
    contractNo: string;
    status: ContractStatus;
    effectiveAt: string;
    endedAt: string | null;
    months: number;
    customerSnapshot?: { fullName?: string; phone?: string | null } | null;
    bookingItem?: {
      storageUnit?: {
        code: string;
        facility?: { name: string; addressLine: string } | null;
      } | null;
    } | null;
  } | null;
};

/** Inspection as the staff app renders it. */
export type StaffInspection = {
  id: string;
  type: InspectionKind;
  inspectedBy: string | null;
  inspectorName: string | null;
  /** The customer's own note on a return request; read-only for staff. */
  requestNote: string | null;
  conditionNotes: string;
  evidence: EvidenceFile[];
  damages: StaffDamage[];
  scheduledAt: string | null;
  finalizedAt: string | null;
  returnedOn: string | null;
  requestSource: ReturnRequestSource | null;
  createdAt: string;
  unitCode: string;
  facilityName: string;
  customerName: string;
  customerPhone: string | null;
  contract: {
    id: string;
    contractNo: string;
    status: ContractStatus;
    effectiveAt: string;
    endedAt: string | null;
    months: number;
  } | null;
};

export type InspectionListStatus = 'open' | 'done';

export type InspectionUpdate = {
  conditionNotes: string;
  evidence: EvidenceFile[];
  damages: StaffDamage[];
};
