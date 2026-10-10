import type { Contract } from '@entities/contract.entity';
import type { Inspection } from '@entities/inspection.entity';
import type { ContractPermissions } from '../contract-access.util';
import { type CustomerContractRecord, toCustomerContractRecord } from './customer-contract';

/** Who signed, as captured when the contract was created. */
export interface ContractCustomer {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

/** The customer view plus what staff need to manage the contract. */
export interface BackOfficeContractRecord extends CustomerContractRecord {
  customer: ContractCustomer;
  terms: Record<string, unknown>;
  created_at: string | Date;
}

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

export function toBackOfficeContractRecord(
  contract: Contract,
  inspections: { handover?: Inspection; return?: Inspection } = {},
): BackOfficeContractRecord {
  const snapshot = contract.customerSnapshot ?? {};
  return {
    ...toCustomerContractRecord(contract, inspections),
    customer: {
      id: contract.customerId,
      full_name: text(snapshot.fullName),
      email: text(snapshot.email),
      phone: text(snapshot.phone),
    },
    terms: contract.termsSnapshot ?? {},
    created_at: contract.createdAt,
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
): StaffContractRecord {
  const { terms: _terms, customer, ...record } = toBackOfficeContractRecord(contract, inspections);
  const { email: _email, ...staffCustomer } = customer;
  return { ...record, customer: staffCustomer, permissions };
}
