import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { UnitChangeRequest } from '@entities/unit-change-request.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { managesFacility } from '@modules/inspection/inspection-access.util';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { ChangeRequestStatus, ContractStatus, NotificationType } from '@storage/types';
import { DataSource, type EntityManager, IsNull } from 'typeorm';
import {
  contractCancelledNotification,
  teardownDraftContract,
} from './contract-draft-teardown.util';

@Injectable()
export class ContractCancelService {
  private readonly logger = new Logger(ContractCancelService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Drops a DRAFT contract the customer never collected (no-show, withdrawn deposit): the
   * contract becomes CANCELLED and its unit goes back on the market. Only a DRAFT can be
   * cancelled — once handover is signed the contract ends through a return inspection.
   * `keepDeposit` is the manager's call for a no-show; a unit change's destination has no
   * deposit of its own, so there is nothing to keep.
   */
  async cancelDraft(contractId: string, actor: AuthUser, keepDeposit = false): Promise<Contract> {
    return this.dataSource.transaction(async (em) => {
      // Lock any linked UnitChangeRequest before Contract so the lock order matches
      // ChangeRequestsService.cancel and MoveDaySweepService (UnitChangeRequest -> Contract).
      const lockedChange = await em.findOne(UnitChangeRequest, {
        where: { newContractId: contractId },
        lock: { mode: 'pessimistic_write' },
      });
      const changeRequest =
        lockedChange?.status === ChangeRequestStatus.AWAITING_HANDOVER ? lockedChange : null;

      const contract = await em.findOne(Contract, {
        where: { id: contractId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contract) notFound('Contract', contractId);

      const item = await em.findOneOrFail(BookingItem, {
        where: { id: contract.bookingItemId },
        relations: { storageUnit: true },
      });
      await this.assertManagesFacility(em, actor, item.storageUnit.facilityId);

      if (contract.status !== ContractStatus.DRAFT) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Only a DRAFT contract can be cancelled',
          HttpStatus.CONFLICT,
          { contractId, status: contract.status, requiredStatus: ContractStatus.DRAFT },
        );
      }

      const now = new Date();

      if (changeRequest) {
        changeRequest.status = ChangeRequestStatus.CANCELLED;
        changeRequest.history = [
          ...(changeRequest.history ?? []),
          {
            action: 'STATUS_CHANGED',
            from: ChangeRequestStatus.AWAITING_HANDOVER,
            to: ChangeRequestStatus.CANCELLED,
            at: now.toISOString(),
            by: actor.id,
            note: 'Huỷ hợp đồng đích trước bàn giao',
          },
        ];
        await em.save(UnitChangeRequest, changeRequest);
      }

      const { settlementId, refundAmount, forfeitedAmount } = await teardownDraftContract(em, {
        contract,
        storageUnitId: item.storageUnitId,
        actorId: actor.id,
        now,
        keepDeposit: keepDeposit && !changeRequest,
        notifications: this.notifications,
        ...(changeRequest
          ? {
              contractNote: 'Huỷ do huỷ hợp đồng đích trước bàn giao',
              settlementNote: 'Hủy hợp đồng đổi kho trước bàn giao — hoàn lại tiền thuê đã thu',
            }
          : {}),
      });

      if (changeRequest) {
        await this.notifications.createForUsers(em, [contract.customerId], {
          type: NotificationType.UNIT_CHANGE_CANCELLED,
          title: 'Yêu cầu đổi kho đã bị huỷ',
          body:
            `Yêu cầu đổi sang kho ${item.storageUnit?.code ?? ''} đã bị chi nhánh huỷ` +
            ' — hợp đồng hiện tại của bạn vẫn giữ nguyên hiệu lực.',
          data: { requestId: changeRequest.id, contractId: changeRequest.contractId },
        });
        if (refundAmount > 0) {
          await this.notifications.createForUsers(
            em,
            [contract.customerId],
            contractCancelledNotification(contract, settlementId, refundAmount),
          );
        }
      } else {
        await this.notifications.createForUsers(
          em,
          [contract.customerId],
          contractCancelledNotification(contract, settlementId, refundAmount, forfeitedAmount),
        );
      }
      this.logger.log(`Contract ${contract.contractNo} cancelled by ${actor.id}`);
      return { ...contract, status: ContractStatus.CANCELLED };
    });
  }

  private async assertManagesFacility(
    em: EntityManager,
    actor: AuthUser,
    facilityId: string,
  ): Promise<void> {
    if (await managesFacility(em, actor, facilityId)) return;
    throw new DomainException(
      ErrorCode.FORBIDDEN,
      'You do not manage the facility this contract belongs to',
      HttpStatus.FORBIDDEN,
    );
  }
}
