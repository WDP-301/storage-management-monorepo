import type { Contract } from '@entities/contract.entity';
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
}

export function toCustomerContractRecord(contract: Contract): CustomerContractRecord {
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
  };
}
