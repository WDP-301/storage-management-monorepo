import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { Invoice } from '@entities/invoice.entity';
import { Payment } from '@entities/payment.entity';
import {
  type LedgerDeposit,
  type ResolvedDeposit,
  resolveContractDeposit,
} from '@modules/contracts/deposit-ledger.util';
import type { SettingsService } from '@modules/settings/settings.service';
import { HttpStatus } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { fromVietnamDate, vietnamDate } from '@shared/utils/calendar.util';
import {
  ContractStatus,
  type DamageSeverity,
  type EvidenceFile,
  InspectionType,
  InvoiceKind,
  PaymentStatus,
  type RefundBankAccount,
  type ReturnRules,
} from '@storage/types';
import { type EntityManager, In, IsNull, Not } from 'typeorm';
import { returnTiming } from './return-timing';
import type { CalcDamage, SettlementCalcInput } from './settlement-calc';

export interface SettlementDamageInput extends CalcDamage {
  evidence: EvidenceFile[];
}

export interface SettlementInput extends SettlementCalcInput {
  /** The latest finalized return inspection. */
  inspection: Inspection;
  returnedOn: string;
  rules: ReturnRules;
  depositRecord: LedgerDeposit | ResolvedDeposit | null;
  customerBankAccount: RefundBankAccount | null;
  damages: SettlementDamageInput[];
}

export function settlementNotReady(contractId: string): DomainException {
  return new DomainException(
    ErrorCode.SETTLEMENT_NOT_READY,
    'Hợp đồng chưa chốt biên trả kho — chưa thể quyết toán cọc',
    HttpStatus.CONFLICT,
    { contractId },
  );
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

function toDamages(damages: unknown[] | null | undefined): SettlementDamageInput[] {
  return (damages ?? []).map((raw, index) => {
    const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return {
      index,
      description: text(d.description),
      severity: (typeof d.severity === 'string' ? d.severity : null) as DamageSeverity | null,
      evidence: Array.isArray(d.evidence) ? (d.evidence as EvidenceFile[]) : [],
      proposedFee: typeof d.proposedFee === 'number' ? d.proposedFee : null,
    };
  });
}

/**
 * Everything the settlement of an ended contract is computed from. `lock: true` (approval, on
 * the caller's transaction after the contract row is locked) records the deposit if missing and
 * locks it, then locks the rent invoices in id order — contract → deposit → invoices, the same
 * order finalize and the payment listener take. Rules come from the return request; a request
 * made before they were captured falls back to the current settings.
 */
export async function loadSettlementInput(
  em: EntityManager,
  contract: Contract,
  settings: SettingsService,
  options: { lock?: boolean } = {},
): Promise<SettlementInput> {
  const inspection = await em.findOne(Inspection, {
    where: { contractId: contract.id, type: InspectionType.RETURN, finalizedAt: Not(IsNull()) },
    relations: { requester: true },
    order: { finalizedAt: 'DESC', createdAt: 'DESC' },
  });
  if (!inspection?.finalizedAt) throw settlementNotReady(contract.id);

  const depositRecord = options.lock
    ? await resolveContractDeposit(em, contract, { create: true })
    : await resolveContractDeposit(em, contract);
  const invoices = await em.find(Invoice, {
    where: { contractId: contract.id, kind: Not(InvoiceKind.SETTLEMENT) },
    order: { id: 'ASC' },
    ...(options.lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
  });
  const payments =
    invoices.length === 0
      ? []
      : await em.find(Payment, {
          where: { invoiceId: In(invoices.map((i) => i.id)), status: PaymentStatus.SUCCEEDED },
          order: { paidAt: 'ASC', createdAt: 'ASC', id: 'ASC' },
        });

  const [rules, goLiveAt] = await Promise.all([
    inspection.returnRules ??
      Promise.all([settings.getReturnNoticeDays(), settings.getOverduePenaltyPercent()]).then(
        ([noticeDays, penaltyPercent]) => ({ noticeDays, penaltyPercent }),
      ),
    settings.getReturnRulesEffectiveAt(),
  ]);
  // Returns finalized before the actual day was recorded count the finalize day.
  const returnedOn = inspection.returnedOn ?? vietnamDate(inspection.finalizedAt);
  const timing = returnTiming({
    effectiveAt: contract.effectiveAt,
    months: contract.months,
    monthlyPrice: contract.monthlyPriceSnapshot,
    noticeFrom: inspection.noticeFrom ?? inspection.createdAt,
    scheduledAt: inspection.scheduledAt ?? fromVietnamDate(returnedOn),
    returnedOn,
    rules,
    goLiveAt,
  });

  return {
    inspection,
    returnedOn,
    rules,
    timing,
    depositRecord,
    deposit: depositRecord
      ? { amount: depositRecord.heldAmount, paymentId: depositRecord.paymentId }
      : null,
    customerBankAccount: inspection.refundAccount ?? null,
    invoices: invoices.map((i) => ({
      id: i.id,
      invoiceNo: i.invoiceNo,
      kind: i.kind,
      status: i.status,
      startAt: i.startAt ?? null,
      dueAt: i.dueAt ?? null,
      total: i.total,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      invoiceId: p.invoiceId as string,
      method: p.method,
      amount: p.amount,
      metadata: p.metadata,
    })),
    damages: toDamages(inspection.damages),
  };
}

/**
 * The contract to settle: not deleted, and ENDED (only a finalized return ends a contract).
 * `lock: true` takes the row lock without joins (FOR UPDATE cannot lock an outer join).
 */
export async function loadEndedContract(
  em: EntityManager,
  contractId: string,
  options: { lock?: boolean } = {},
): Promise<Contract> {
  const contract = await em.findOne(Contract, {
    where: { id: contractId, deletedAt: IsNull() },
    ...(options.lock
      ? { lock: { mode: 'pessimistic_write' as const } }
      : { relations: { customer: true, bookingItem: { storageUnit: { facility: true } } } }),
  });
  if (!contract) notFound('Contract', contractId);
  if (contract.status !== ContractStatus.ENDED) throw settlementNotReady(contractId);
  return contract;
}
