import type { Contract } from '@entities/contract.entity';
import { ContractSettlement } from '@entities/contract-settlement.entity';
import { PAYABLE_INVOICE_STATUSES, sumInvoicePayments } from '@modules/contracts/first-rent.util';
import { SettingsService } from '@modules/settings/settings.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import type { SettlementDecisionsInput, SettlementDetailRecord } from '@storage/types';
import Decimal from 'decimal.js';
import { DataSource, type EntityManager } from 'typeorm';
import { computeSettlement, type SettlementComputation } from './settlement-calc';
import {
  loadEndedContract,
  loadSettlementInput,
  type SettlementInput,
} from './settlement-input.loader';
import {
  accountNameWarnings,
  depositMissingWarning,
  toSettlementDetailRecord,
} from './settlement-records';
import { settlementVersion } from './settlement-totals';

export const SETTLEMENT_RELATIONS = {
  deposit: true,
  feeInvoice: true,
  approver: true,
  completer: true,
  bankOverrider: true,
} as const;

export function settlementAlreadyApproved(contractId: string): DomainException {
  return new DomainException(
    ErrorCode.SETTLEMENT_ALREADY_APPROVED,
    'Quyết toán cọc của hợp đồng này đã được duyệt',
    HttpStatus.CONFLICT,
    { contractId },
  );
}

/** The lines, totals and version a reviewer sees for these decisions; approval recomputes it. */
export function evaluateSettlement(
  input: SettlementInput,
  decisions: SettlementDecisionsInput,
): { computation: SettlementComputation; version: string } {
  const computation = computeSettlement(input, decisions);
  const version = settlementVersion({
    deposit: input.deposit,
    lines: computation.lines,
    totals: computation.totals,
    customerBankAccount: input.customerBankAccount,
    effectiveReturnDay: input.timing.effectiveReturnDay,
  });
  return { computation, version };
}

/** Back-office read side of deposit settlements: a live preview until approved, then frozen. */
@Injectable()
export class SettlementQueryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
  ) {}

  async detail(contractId: string): Promise<SettlementDetailRecord> {
    const em = this.dataSource.manager;
    const contract = await loadEndedContract(em, contractId);
    const [settlement, input] = await Promise.all([
      em.findOne(ContractSettlement, { where: { contractId }, relations: SETTLEMENT_RELATIONS }),
      loadSettlementInput(em, contract, this.settings),
    ]);
    if (settlement) return this.frozen(em, contract, input, settlement);
    return this.pending(contract, input, {});
  }

  /** What approving with these decisions would give. Records nothing. */
  async preview(
    contractId: string,
    decisions: SettlementDecisionsInput,
  ): Promise<SettlementDetailRecord> {
    const em = this.dataSource.manager;
    const contract = await loadEndedContract(em, contractId);
    if (await em.exists(ContractSettlement, { where: { contractId } })) {
      throw settlementAlreadyApproved(contractId);
    }
    const input = await loadSettlementInput(em, contract, this.settings);
    return this.pending(contract, input, decisions);
  }

  private pending(
    contract: Contract,
    input: SettlementInput,
    decisions: SettlementDecisionsInput,
  ): SettlementDetailRecord {
    const { computation, version } = evaluateSettlement(input, decisions);
    const deposit = input.depositRecord;
    return toSettlementDetailRecord({
      contract,
      input,
      status: 'PENDING',
      deposit: deposit
        ? { id: deposit.id, amount: Number(deposit.heldAmount), status: deposit.status }
        : null,
      lines: computation.lines,
      totals: computation.totals,
      warnings: [
        ...(input.deposit ? [] : [depositMissingWarning()]),
        ...accountNameWarnings(input.customerBankAccount, contract),
      ],
      version,
      settlement: null,
      feeInvoice: null,
    });
  }

  private async frozen(
    em: EntityManager,
    contract: Contract,
    input: SettlementInput,
    settlement: ContractSettlement,
  ): Promise<SettlementDetailRecord> {
    const totals = {
      deposit_amount: Number(settlement.depositAmount),
      credits_total: Number(settlement.creditsTotal),
      deductions_total: Number(settlement.deductionsTotal),
      refund_amount: Number(settlement.refundAmount),
      shortfall_amount: Number(settlement.shortfallAmount),
    };
    const fee = settlement.feeInvoice;
    const feePaid = fee ? await sumInvoicePayments(em, fee.id) : new Decimal(0);
    return toSettlementDetailRecord({
      contract,
      input,
      status: settlement.status,
      deposit: {
        id: settlement.depositId,
        amount: totals.deposit_amount,
        status: settlement.deposit.status,
      },
      lines: settlement.lines,
      totals,
      warnings: accountNameWarnings(settlement.bankAccount, contract),
      version: settlementVersion({
        deposit: { amount: totals.deposit_amount, paymentId: settlement.deposit.paymentId ?? null },
        lines: settlement.lines,
        totals,
        customerBankAccount: settlement.customerBankAccount ?? null,
        effectiveReturnDay: input.timing.effectiveReturnDay,
      }),
      settlement,
      feeInvoice: fee
        ? {
            id: fee.id,
            invoice_no: fee.invoiceNo,
            status: fee.status,
            total: Number(fee.total),
            // Same rule as the customer's invoices: nothing is due on one that takes no money.
            amount_due: PAYABLE_INVOICE_STATUSES.includes(fee.status)
              ? Decimal.max(new Decimal(fee.total).minus(feePaid), 0).toNumber()
              : 0,
          }
        : null,
    });
  }
}
