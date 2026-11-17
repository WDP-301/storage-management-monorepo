import { Contract } from '@entities/contract.entity';
import { ContractSettlement } from '@entities/contract-settlement.entity';
import { Deposit } from '@entities/deposit.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { BanksService } from '@modules/banks/banks.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException, fieldValidationError } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { isUniqueViolation } from '@shared/utils/pg-error.util';
import {
  type CompleteRefundInput,
  type RefundBankAccount,
  type SettlementDetailRecord,
  SettlementStatus,
} from '@storage/types';
import { DataSource } from 'typeorm';
import { chooseRefundAccount } from './settlement-bank-account.util';
import { refundCompletedNotification } from './settlement-notifications';
import { SettlementQueryService } from './settlement-query.service';
import { settledDepositStatus } from './settlement-totals';

const duplicateTransferRef = (transferRef: string) =>
  new DomainException(
    ErrorCode.CONFLICT,
    'Mã giao dịch này đã được dùng cho một lần hoàn cọc khác',
    HttpStatus.CONFLICT,
    { transferRef },
  );

/** Records that the manual refund transfer was made, which completes the settlement. */
@Injectable()
export class SettlementRefundService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
    private readonly query: SettlementQueryService,
    private readonly banks: BanksService,
  ) {}

  /**
   * Needs proof — at least one evidence file of the transfer; the bank reference is optional but
   * unique when given. When no refund account was saved beforehand (e.g. a DRAFT cancel with no
   * saved customer account), `bankAccount` must be supplied here before the refund can complete.
   */
  async complete(
    contractId: string,
    dto: CompleteRefundInput,
    actor: AuthUser,
  ): Promise<SettlementDetailRecord> {
    const evidence = dto.evidence ?? [];
    const transferRef = dto.transferRef?.trim() || null;
    if (evidence.length === 0) {
      throw fieldValidationError(
        'evidence',
        'proofRequired',
        'Đính kèm ít nhất 1 ảnh chứng từ chuyển khoản',
      );
    }
    const verifiedBank = dto.bankAccount ? await this.banks.verifyAccount(dto.bankAccount) : null;
    const now = new Date();
    try {
      await this.dataSource.transaction(async (em) => {
        const settlement = await em.findOne(ContractSettlement, {
          where: { contractId },
          lock: { mode: 'pessimistic_write' },
        });
        if (settlement?.status !== SettlementStatus.AWAITING_REFUND) {
          throw new DomainException(
            ErrorCode.REFUND_NOT_PENDING,
            settlement
              ? 'Quyết toán này không còn chờ hoàn tiền'
              : 'Quyết toán cọc của hợp đồng này chưa được duyệt',
            HttpStatus.CONFLICT,
            { contractId, status: settlement?.status ?? 'PENDING' },
          );
        }
        if (transferRef && (await em.exists(ContractSettlement, { where: { transferRef } }))) {
          throw duplicateTransferRef(transferRef);
        }

        const refundAmount = Number(settlement.refundAmount);
        let bankPatch: Partial<ContractSettlement> = {};
        let finalBankAccount: RefundBankAccount | null = settlement.bankAccount ?? null;
        if (verifiedBank || (!finalBankAccount && refundAmount > 0)) {
          const choice = chooseRefundAccount({
            refundAmount,
            customerAccount: settlement.customerBankAccount ?? null,
            bankAccount: verifiedBank ?? undefined,
            overrideReason: dto.bankOverrideReason,
            actorId: actor.id,
          });
          bankPatch = {
            bankAccount: choice.bankAccount,
            bankOverrideBy: choice.overrideBy,
            bankOverrideReason: choice.overrideReason,
          };
          finalBankAccount = choice.bankAccount;
        }

        const note = [settlement.note, dto.note?.trim()].filter(Boolean).join('\n') || null;
        await em.update(
          ContractSettlement,
          { id: settlement.id },
          {
            status: SettlementStatus.COMPLETED,
            transferRef,
            evidence,
            note,
            completedBy: actor.id,
            completedAt: now,
            ...bankPatch,
          },
        );
        const totals = {
          deposit_amount: Number(settlement.depositAmount),
          credits_total: Number(settlement.creditsTotal),
          refund_amount: refundAmount,
        };
        await em.update(
          Deposit,
          { id: settlement.depositId },
          { heldAmount: 0, status: settledDepositStatus(totals) },
        );
        const contract = await em.findOneOrFail(Contract, { where: { id: contractId } });
        await this.notifications.createForUsers(
          em,
          [contract.customerId],
          refundCompletedNotification(
            contract,
            settlement.id,
            totals.refund_amount,
            finalBankAccount,
          ),
        );
      });
    } catch (err) {
      if (transferRef && isUniqueViolation(err)) throw duplicateTransferRef(transferRef);
      throw err;
    }
    return this.query.detail(contractId);
  }
}
