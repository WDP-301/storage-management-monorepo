import type { Contract } from '@entities/contract.entity';
import type { Inspection } from '@entities/inspection.entity';
import type { ContractKind, ContractStatus } from '@storage/types';

export interface CustomerContractUnit {
  id: string;
  code: string;
  area_m2: number;
  status: string;
  type_name: string | null;
}

export interface CustomerContractFacility {
  id: string;
  name: string;
  address_line: string;
}

export interface CustomerInspectionSummary {
  id: string;
  type: string;
  scheduled_at: string | Date | null;
  inspected_at: string | Date | null;
  finalized_at: string | Date | null;
  inspector_name: string | null;
  condition_notes: string | null;
  evidence: unknown[];
  damages: unknown[];
}

export interface CustomerContractRecord {
  id: string;
  contract_no: string;
  kind: ContractKind;
  status: ContractStatus;
  effective_at: string | Date;
  ended_at: string | Date | null;
  months: number;
  monthly_price: number;
  deposit: number;
  unit: CustomerContractUnit | null;
  facility: CustomerContractFacility | null;
  /** Handover receipt (PRE_HANDOVER inspection); finalized once the customer received the unit. */
  handover: CustomerInspectionSummary | null;
  /** Latest RETURN inspection — open while the customer waits to move out. */
  return: CustomerInspectionSummary | null;
}

export function toCustomerInspectionSummary(inspection: Inspection): CustomerInspectionSummary {
  return {
    id: inspection.id,
    type: inspection.type,
    scheduled_at: inspection.scheduledAt ?? null,
    inspected_at: inspection.inspectedAt ?? null,
    finalized_at: inspection.finalizedAt ?? null,
    inspector_name: inspection.inspector?.fullName ?? null,
    condition_notes: inspection.conditionNotes ?? null,
    evidence: inspection.evidence ?? [],
    damages: inspection.damages ?? [],
  };
}

export function toCustomerContractRecord(
  contract: Contract,
  inspections: { handover?: Inspection; return?: Inspection } = {},
): CustomerContractRecord {
  const unit = contract.bookingItem?.storageUnit;
  return {
    id: contract.id,
    contract_no: contract.contractNo,
    kind: contract.kind,
    status: contract.status,
    effective_at: contract.effectiveAt,
    ended_at: contract.endedAt ?? null,
    months: contract.months,
    monthly_price: contract.monthlyPriceSnapshot,
    deposit: contract.bookingItem?.depositSnapshot ?? 0,
    unit: unit
      ? {
          id: unit.id,
          code: unit.code,
          area_m2: unit.areaM2,
          status: unit.status,
          type_name: unit.unitType?.name ?? null,
        }
      : null,
    facility: unit?.facility
      ? {
          id: unit.facility.id,
          name: unit.facility.name,
          address_line: unit.facility.addressLine,
        }
      : null,
    handover: inspections.handover ? toCustomerInspectionSummary(inspections.handover) : null,
    return: inspections.return ? toCustomerInspectionSummary(inspections.return) : null,
  };
}
