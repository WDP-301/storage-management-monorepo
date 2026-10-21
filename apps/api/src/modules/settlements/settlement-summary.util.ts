import type { Contract } from '@entities/contract.entity';
import { ContractSettlement } from '@entities/contract-settlement.entity';
import type { ContractInspections } from '@modules/contracts/contract-inspections.util';
import { resolveDepositAmounts } from '@modules/contracts/deposit-ledger.util';
import type { BackOfficeContractExtras } from '@modules/contracts/types/back-office-contract';
import type { CustomerContractExtras } from '@modules/contracts/types/customer-contract';
import {
  type ContractSettlementStatus,
  ContractStatus,
  type SettlementLine,
  SettlementLineType,
  type SettlementSummaryRecord,
} from '@storage/types';
import Decimal from 'decimal.js';
import { type EntityManager, In } from 'typeorm';
import { maskRefundAccount } from './settlement-records';

type SettledContract = Pick<Contract, 'id' | 'status' | 'bookingItemId'>;

const amountOrNull = (value: string | null | undefined): number | null =>
  value == null ? null : Number(value);

/** Per-day overstay charge: monthly rent / 30 × percent / 100, half-up to the dong (as returnTiming). */
export function overduePenaltyPerDay(monthlyPrice: Decimal.Value, percent: number): number {
  return new Decimal(monthlyPrice)
    .mul(percent)
    .div(30 * 100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}

/** Settlement status per contract: the row's, PENDING for an ENDED contract without one, else null. */
export async function loadSettlementStatuses(
  em: EntityManager,
  contracts: Pick<Contract, 'id' | 'status'>[],
): Promise<Map<string, ContractSettlementStatus | null>> {
  const rows: { contractId: string; status: ContractSettlementStatus }[] =
    contracts.length === 0
      ? []
      : await em.query(
          `SELECT contract_id AS "contractId", status FROM contract_settlements
            WHERE contract_id = ANY($1::uuid[])`,
          [contracts.map((c) => c.id)],
        );
  const byContract = new Map(rows.map((row) => [row.contractId, row.status]));
  return new Map(
    contracts.map((c) => [
      c.id,
      byContract.get(c.id) ?? (c.status === ContractStatus.ENDED ? 'PENDING' : null),
    ]),
  );
}

/** What back-office lists show beside a contract: the deposit and the settlement status only. */
export async function loadBackOfficeContractExtras(
  em: EntityManager,
  contracts: SettledContract[],
): Promise<Map<string, BackOfficeContractExtras>> {
  const [deposits, statuses] = await Promise.all([
    resolveDepositAmounts(em, contracts),
    loadSettlementStatuses(em, contracts),
  ]);
  return new Map(
    contracts.map((c) => [
      c.id,
      {
        deposit: amountOrNull(deposits.get(c.id)),
        settlementStatus: statuses.get(c.id) ?? null,
      },
    ]),
  );
}

/**
 * Settlement lines as the customer reads them: only what was decided. Staff-only detail goes —
 * the fee first proposed for a damage (also kept as the unit amount of a waived one), the
 * internal reason for a waiver, and money under review that staff left out.
 */
export function customerSettlementLines(lines: readonly SettlementLine[]): SettlementLine[] {
  return lines
    .filter((l) => !(l.type === SettlementLineType.REVIEW_PAYMENT_CREDIT && l.included === false))
    .map((l) => ({
      ...l,
      waive_reason: null,
      ...(l.proposed_amount !== undefined ? { proposed_amount: null } : {}),
      ...(l.type === SettlementLineType.DAMAGE && l.waived ? { unit_amount: 0 } : {}),
    }));
}

function toSummary(
  settlement: ContractSettlement | undefined,
  inspections: ContractInspections | undefined,
  deposit: number | null,
): SettlementSummaryRecord {
  if (!settlement) {
    return {
      status: 'PENDING',
      deposit_amount: deposit,
      lines: [],
      totals: null,
      refund_account: maskRefundAccount(inspections?.return?.refundAccount),
      fee_invoice_id: null,
      approved_at: null,
      completed_at: null,
    };
  }
  return {
    status: settlement.status,
    deposit_amount: Number(settlement.depositAmount),
    lines: customerSettlementLines(settlement.lines ?? []),
    totals: {
      deposit_amount: Number(settlement.depositAmount),
      credits_total: Number(settlement.creditsTotal),
      deductions_total: Number(settlement.deductionsTotal),
      refund_amount: Number(settlement.refundAmount),
      shortfall_amount: Number(settlement.shortfallAmount),
    },
    refund_account: maskRefundAccount(settlement.bankAccount),
    fee_invoice_id: settlement.feeInvoiceId ?? null,
    approved_at: settlement.approvedAt,
    completed_at: settlement.completedAt ?? null,
  };
}

/**
 * Batch extras of `/contracts/mine`: the deposit (resolver, null when unknown), the per-day
 * overstay charge (the return request's captured percent, else the current one) and, for ENDED
 * contracts, the settlement summary with the refund account masked.
 */
export async function loadCustomerContractExtras(
  em: EntityManager,
  contracts: (SettledContract & Pick<Contract, 'monthlyPriceSnapshot'>)[],
  inspections: Map<string, ContractInspections>,
  currentPenaltyPercent: number,
): Promise<Map<string, CustomerContractExtras>> {
  const endedIds = contracts.filter((c) => c.status === ContractStatus.ENDED).map((c) => c.id);
  const [deposits, settlements] = await Promise.all([
    resolveDepositAmounts(em, contracts),
    endedIds.length === 0
      ? Promise.resolve([] as ContractSettlement[])
      : em.find(ContractSettlement, { where: { contractId: In(endedIds) } }),
  ]);
  const settlementOf = new Map(settlements.map((s) => [s.contractId, s]));
  return new Map(
    contracts.map((c) => {
      const own = inspections.get(c.id);
      const deposit = amountOrNull(deposits.get(c.id));
      const percent = own?.return?.returnRules?.penaltyPercent ?? currentPenaltyPercent;
      return [
        c.id,
        {
          deposit,
          penaltyPerDay: overduePenaltyPerDay(c.monthlyPriceSnapshot ?? 0, percent),
          settlement:
            c.status === ContractStatus.ENDED
              ? toSummary(settlementOf.get(c.id), own, deposit)
              : null,
        },
      ];
    }),
  );
}
