import type { ContractStatus } from '@storage/types';
import type { EvidenceFile, InspectionDamage } from './contract-api';

export type InspectionKind = 'PRE_HANDOVER' | 'RETURN' | 'MAINTENANCE';

/** Raw inspection entity from `/inspections*` — camelCase, nested relations. */
export type InspectionResponse = {
  id: string;
  type: InspectionKind;
  inspectedBy: string | null;
  conditionNotes: string | null;
  evidence: unknown[] | null;
  damages: unknown[] | null;
  scheduledAt: string | null;
  inspectedAt: string | null;
  finalizedAt: string | null;
  createdAt: string;
  inspector?: { fullName: string } | null;
  contract?: {
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
  conditionNotes: string;
  evidence: EvidenceFile[];
  damages: InspectionDamage[];
  scheduledAt: string | null;
  finalizedAt: string | null;
  createdAt: string;
  unitCode: string;
  facilityName: string;
  customerName: string;
  customerPhone: string | null;
  contract: {
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
  damages: InspectionDamage[];
};
