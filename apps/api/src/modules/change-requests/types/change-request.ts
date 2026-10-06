import type { UnitChangeRequest } from '@entities/unit-change-request.entity';
import type { ChangeRequestStatus, PaginationMeta } from '@storage/types';

export interface ChangeRequestUnitInfo {
  id: string;
  code: string;
}

export interface ChangeRequestUserInfo {
  id: string;
  full_name: string;
  email: string;
}

export interface ChangeRequestRecord {
  id: string;
  contract_id: string;
  old_unit_id: string;
  new_unit_id: string | null;
  requested_by: string;
  approved_by: string | null;
  reason: string;
  status: ChangeRequestStatus;
  rent_difference: number;
  deposit_difference: number;
  decision_note: string | null;
  history: unknown[];
  created_at: string | Date;
  updated_at: string | Date;
  facility_id: string | null;
  requester: ChangeRequestUserInfo | null;
  old_unit: (ChangeRequestUnitInfo & { facility_id?: string }) | null;
  new_unit: ChangeRequestUnitInfo | null;
}

export function toChangeRequestRecord(request: UnitChangeRequest): ChangeRequestRecord {
  return {
    id: request.id,
    contract_id: request.contractId,
    old_unit_id: request.oldUnitId,
    new_unit_id: request.newUnitId ?? null,
    requested_by: request.requestedBy,
    approved_by: request.approvedBy ?? null,
    reason: request.reason,
    status: request.status,
    rent_difference: request.rentDifference,
    deposit_difference: request.depositDifference,
    decision_note: request.decisionNote ?? null,
    history: request.history ?? [],
    created_at: request.createdAt,
    updated_at: request.updatedAt,
    facility_id: request.oldUnit?.facilityId ?? null,
    requester: request.requester
      ? {
          id: request.requester.id,
          full_name: request.requester.fullName,
          email: request.requester.email,
        }
      : null,
    old_unit: request.oldUnit
      ? {
          id: request.oldUnit.id,
          code: request.oldUnit.code,
          facility_id: request.oldUnit.facilityId,
        }
      : null,
    new_unit: request.newUnit ? { id: request.newUnit.id, code: request.newUnit.code } : null,
  };
}

export interface ChangeRequestResponse {
  request: ChangeRequestRecord;
}

export interface ChangeRequestListResponse {
  requests: ChangeRequestRecord[];
  meta: PaginationMeta;
}
