import { randomUUID } from 'node:crypto';
import { ContractSettlement } from '@entities/contract-settlement.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { BanksService } from '@modules/banks/banks.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { SettingsService } from '@modules/settings/settings.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { isUniqueViolation } from '@shared/utils/pg-error.util';
import {
  type ApproveSettlementInput,
  type SettlementDetailRecord,
  SettlementStatus,
} from '@storage/types';
import { DataSource } from 'typeorm';
import { applySettlement } from './settlement-apply.util';
import { chooseRefundAccount } from './settlement-bank-account.util';
import { loadEndedContract, loadSettlementInput } from './settlement-input.loader';
import { settlementApprovedNotification } from './settlement-notifications';
import {
  evaluateSettlement,
  SettlementQueryService,
  settlementAlreadyApproved,
} from './settlement-query.service';
import { voidUnstartedInvoices } from './unstarted-invoices.util';

const conflict = (code: ErrorCode, message: string, details: Record<string, unknown>) =>
  new DomainException(code, message, HttpStatus.CONFLICT, details);

/** Approves a deposit settlement: OPS/ADMIN freeze the figures and the money moves at once. */
@Injectable()
export class SettlementApproveService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly query: SettlementQueryService,
    private readonly banks: BanksService,
  ) {}

  /**
   * One transaction under the contract row lock, so a second approval waits and then sees the
   * first (409; the unique contract_id is the last guard). Everything is recomputed after the
   * locks; figures that moved since the reviewer loaded them are refused (SETTLEMENT_CHANGED).
   */
  async approve(
    contractId: string,
    dto: ApproveSettlementInput,
    actor: AuthUser,
  ): Promise<SettlementDetailRecord> {
    const now = new Date();
    // Looked up before the locks are taken: the bank call can take seconds.
    const bankAccount = dto.bankAccount
      ? await this.banks.verifyAccount(dto.bankAccount)
      : undefined;
    try {
      await this.dataSource.transaction(async (em) => {
        const contract = await loadEndedContract(em, contractId, { lock: true });
        if (await em.exists(ContractSettlement, { where: { contractId } })) {
          throw settlementAlreadyApproved(contractId);
        }
        const input = await loadSettlementInput(em, contract, this.settings, { lock: true });
        const deposit = input.depositRecord;
        if (!deposit?.id || !input.deposit) {
          throw conflict(
            ErrorCode.DEPOSIT_MISSING,
            'Không xác định được tiền cọc đã nộp — cần kiểm tra thủ công',
            { contractId },
          );
        }
        await voidUnstartedInvoices(em, contract.id, input.timing.effectiveReturnDay);

        const { computation, version } = evaluateSettlement(input, dto);
        const { pending } = computation;
        if (pending.damageIndexes.length > 0 || pending.paymentIds.length > 0) {
          throw conflict(
            ErrorCode.DECISION_REQUIRED,
            'Cần quyết định cho mọi hư hỏng và mọi khoản tiền cần kiểm tra trước khi duyệt',
            pending,
          );
        }
        if (version !== dto.expectedVersion) {
          throw conflict(
            ErrorCode.SETTLEMENT_CHANGED,
            'Số liệu quyết toán đã thay đổi — tải lại trước khi duyệt',
            { version },
          );
        }
        const totals = computation.totals as NonNullable<typeof computation.totals>;
        const account = chooseRefundAccount({
          refundAmount: totals.refund_amount,
          customerAccount: input.customerBankAccount,
          bankAccount,
          overrideReason: dto.bankOverrideReason,
          actorId: actor.id,
        });

        const settlementId = randomUUID();
        const applied = await applySettlement(em, {
          settlementId,
          contract,
          depositId: deposit.id,
          lines: computation.lines,
          totals,
          invoices: new Map(input.invoices.map((i) => [i.id, i])),
          now,
        });
        const completed = applied.status === SettlementStatus.COMPLETED;
        await em.insert(ContractSettlement, {
          id: settlementId,
          contractId,
          depositId: deposit.id,
          status: applied.status,
          lines: computation.lines,
          depositAmount: totals.deposit_amount,
          creditsTotal: totals.credits_total,
          deductionsTotal: totals.deductions_total,
          refundAmount: totals.refund_amount,
          shortfallAmount: totals.shortfall_amount,
          feeInvoiceId: applied.feeInvoice?.id ?? null,
          customerBankAccount: input.customerBankAccount,
          bankAccount: account.bankAccount,
          bankOverrideBy: account.overrideBy,
          bankOverrideReason: account.overrideReason,
          evidence: [],
          note: dto.note?.trim() || null,
          approvedBy: actor.id,
          approvedAt: now,
          completedBy: completed ? actor.id : null,
          completedAt: completed ? now : null,
        });
        await this.notifications.createForUsers(
          em,
          [contract.customerId],
          settlementApprovedNotification(
            contract,
            settlementId,
            totals,
            account.bankAccount,
            applied,
          ),
        );
      });
    } catch (err) {
      if (isUniqueViolation(err) && constraintOf(err) === 'UQ_contract_settlements_contract') {
        throw settlementAlreadyApproved(contractId);
      }
      throw err;
    }
    return this.query.detail(contractId);
  }
}

function constraintOf(err: unknown): string | undefined {
  const e = err as { constraint?: unknown; driverError?: { constraint?: unknown } };
  const name = e?.constraint ?? e?.driverError?.constraint;
  return typeof name === 'string' ? name : undefined;
}
