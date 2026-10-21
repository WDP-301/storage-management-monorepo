import { hashBody } from '@shared/utils/canonical-json.util';
import {
  DepositStatus,
  type RefundBankAccount,
  type SettlementLine,
  type SettlementTotals,
} from '@storage/types';
import Decimal from 'decimal.js';
import type { SettlementCalcInput } from './settlement-calc';

const num = (value: Decimal.Value): number => new Decimal(value).toNumber();

/** pool = deposit + credits; whatever the deductions leave is refunded, a shortfall is billed. */
export function settlementTotals(
  deposit: Decimal.Value,
  lines: SettlementLine[],
): SettlementTotals {
  const sum = (direction: SettlementLine['direction']) =>
    lines
      .filter((l) => l.direction === direction)
      .reduce((s, l) => s.plus(l.amount), new Decimal(0));
  const credits = sum('CREDIT');
  const deductions = sum('DEDUCTION');
  const pool = new Decimal(deposit).plus(credits);
  return {
    deposit_amount: num(deposit),
    credits_total: credits.toNumber(),
    deductions_total: deductions.toNumber(),
    refund_amount: Decimal.max(pool.minus(deductions), 0).toNumber(),
    shortfall_amount: Decimal.max(deductions.minus(pool), 0).toNumber(),
  };
}

/**
 * Deposit status once the refund is done: the part of the refund that is the deposit itself
 * (refund − credits, within 0..deposit). All of it → REFUNDED (a zero deposit too), none →
 * FORFEITED, otherwise PARTIALLY_REFUNDED.
 */
export function settledDepositStatus(
  totals: Pick<SettlementTotals, 'deposit_amount' | 'credits_total' | 'refund_amount'>,
): DepositStatus {
  const deposit = new Decimal(totals.deposit_amount);
  const refunded = Decimal.min(
    Decimal.max(new Decimal(totals.refund_amount).minus(totals.credits_total), 0),
    deposit,
  );
  if (refunded.eq(deposit)) return DepositStatus.REFUNDED;
  if (refunded.eq(0)) return DepositStatus.FORFEITED;
  return DepositStatus.PARTIALLY_REFUNDED;
}

/**
 * Fingerprint of what the reviewer saw. The deposit is identified by amount and payment rather
 * than its ledger row, so a deposit first recorded at approval keeps the same version.
 */
export function settlementVersion(parts: {
  deposit: SettlementCalcInput['deposit'];
  lines: SettlementLine[];
  totals: SettlementTotals | null;
  customerBankAccount: RefundBankAccount | null;
  effectiveReturnDay: string;
}): string {
  return hashBody({
    deposit: parts.deposit
      ? { amount: num(parts.deposit.amount), paymentId: parts.deposit.paymentId }
      : null,
    lines: parts.lines,
    totals: parts.totals,
    customerBankAccount: parts.customerBankAccount,
    effectiveReturnDay: parts.effectiveReturnDay,
  });
}
