import type { Contract } from '@entities/contract.entity';
import type { Inspection } from '@entities/inspection.entity';
import type { ContractSettlementStatus } from '@storage/types';
import type { ContractPermissions } from '../contract-access.util';
import type { FirstRentSummary } from '../first-rent.util';
import { type CustomerContractRecord, toCustomerContractRecord } from './customer-contract';

/** Who signed, as captured when the contract was created. */
export interface ContractCustomer {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

/**
 * The customer view plus what staff need to manage the contract. The settlement itself is only
 * read through the settlement endpoints; here just its status.
 */
export type BackOfficeContractRecord = Omit<
  CustomerContractRecord,
  'settlement' | 'overdue_penalty_per_day'
> & {
  customer: ContractCustomer;
  terms: Record<string, unknown>;
  created_at: string | Date;
  /** First month's rent invoice; null until staff issue it at check-in. */
  first_rent: FirstRentSummary | null;
  /** Deposit settlement: PENDING for an ENDED contract not yet settled; null before it ends. */
  settlement_status: ContractSettlementStatus | null;
};

export interface BackOfficeContractExtras {
  deposit: number | null;
  settlementStatus: ContractSettlementStatus | null;
}

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

export function toBackOfficeContractRecord(
  contract: Contract,
  inspections: { handover?: Inspection; return?: Inspection } = {},
  firstRent: FirstRentSummary | null = null,
  extras: Partial<BackOfficeContractExtras> = {},
): BackOfficeContractRecord {
  const snapshot = contract.customerSnapshot ?? {};
  const {
    settlement: _settlement,
    overdue_penalty_per_day: _penalty,
    ...record
  } = toCustomerContractRecord(contract, inspections, { deposit: extras.deposit });
  return {
    ...record,
    customer: {
      id: contract.customerId,
      full_name: text(snapshot.fullName),
      email: text(snapshot.email),
      phone: text(snapshot.phone),
    },
    terms: contract.termsSnapshot ?? {},
    created_at: contract.createdAt,
    first_rent: firstRent,
    settlement_status: extras.settlementStatus ?? null,
  };
}

/**
 * What facility staff see: the back-office record without the commercial terms and the
 * customer's email, plus what the caller may edit.
 */
export type StaffContractRecord = Omit<BackOfficeContractRecord, 'terms' | 'customer'> & {
  customer: Omit<ContractCustomer, 'email'>;
  permissions: ContractPermissions;
};

export function toStaffContractRecord(
  contract: Contract,
  inspections: { handover?: Inspection; return?: Inspection },
  permissions: ContractPermissions,
  firstRent: FirstRentSummary | null = null,
  extras: Partial<BackOfficeContractExtras> = {},
): StaffContractRecord {
  const {
    terms: _terms,
    customer,
    ...record
  } = toBackOfficeContractRecord(contract, inspections, firstRent, extras);
  const { email: _email, ...staffCustomer } = customer;
  return { ...record, customer: staffCustomer, permissions };
}
