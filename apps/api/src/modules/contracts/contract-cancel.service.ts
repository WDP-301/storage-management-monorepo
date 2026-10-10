import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { managesFacility } from '@modules/inspection/inspection-access.util';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { ContractStatus, StorageUnitStatus } from '@storage/types';
import { DataSource, type EntityManager, In, IsNull } from 'typeorm';

@Injectable()
export class ContractCancelService {
  private readonly logger = new Logger(ContractCancelService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Drops a DRAFT contract the customer never collected (no-show, withdrawn deposit): the
   * contract becomes CANCELLED and its unit goes back on the market. Only a DRAFT can be
   * cancelled — once handover is signed the contract ends through a return inspection.
   */
  async cancelDraft(contractId: string, actor: AuthUser): Promise<Contract> {
    return this.dataSource.transaction(async (em) => {
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

      await em.update(Contract, { id: contract.id }, { status: ContractStatus.CANCELLED });
      await em.update(
        StorageUnit,
        { id: item.storageUnitId, status: In([StorageUnitStatus.BOOKED, StorageUnitStatus.HELD]) },
        { status: StorageUnitStatus.AVAILABLE },
      );
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
