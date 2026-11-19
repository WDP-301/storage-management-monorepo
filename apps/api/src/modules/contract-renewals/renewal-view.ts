import type { ContractRenewal } from '@entities/contract-renewal.entity';
import type { ContractRenewalView } from '@storage/types';
import Decimal from 'decimal.js';
import type { RenewalFacts } from './renewal-notifications';
import { termEndAt } from './renewal-rules.util';

/** Relations a view needs; load renewals with these. */
export const RENEWAL_VIEW_RELATIONS = {
  contract: { bookingItem: { storageUnit: { facility: true } } },
  customer: true,
  decider: true,
} as const;

/**
 * The term a request extends: the contract's current one while it is open, the replaced one once
 * approved (the contract has grown since).
 */
function termMonths(renewal: ContractRenewal): number {
  return renewal.previousMonths ?? renewal.contract?.months ?? 0;
}

export function renewalFacts(renewal: ContractRenewal): RenewalFacts {
  const contract = renewal.contract;
  if (!contract) throw new Error(`Renewal ${renewal.id} loaded without its contract`);
  return {
    renewalId: renewal.id,
    contractId: contract.id,
    contractNo: contract.contractNo,
    unitCode: contract.bookingItem?.storageUnit?.code ?? null,
    months: renewal.months,
    newTermEndAt: termEndAt(contract, termMonths(renewal) + renewal.months),
  };
}

export function toRenewalView(renewal: ContractRenewal): ContractRenewalView {
  const contract = renewal.contract;
  if (!contract) throw new Error(`Renewal ${renewal.id} loaded without its contract`);
  const unit = contract.bookingItem?.storageUnit ?? null;
  const months = termMonths(renewal);
  return {
    id: renewal.id,
    contract_id: contract.id,
    contract_no: contract.contractNo,
    unit_code: unit?.code ?? null,
    facility_id: unit?.facilityId ?? null,
    facility_name: unit?.facility?.name ?? null,
    customer: renewal.customer
      ? {
          id: renewal.customer.id,
          full_name: renewal.customer.fullName,
          phone: renewal.customer.phone ?? null,
        }
      : null,
    months: renewal.months,
    term_months: months,
    term_end_at: termEndAt(contract, months).toISOString(),
    new_term_end_at: termEndAt(contract, months + renewal.months).toISOString(),
    monthly_price: new Decimal(contract.monthlyPriceSnapshot ?? 0).toNumber(),
    status: renewal.status,
    note: renewal.note,
    decision_note: renewal.decisionNote,
    decided_at: renewal.decidedAt ? renewal.decidedAt.toISOString() : null,
    decided_by_name: renewal.decider?.fullName ?? null,
    created_at: renewal.createdAt.toISOString(),
  };
}
