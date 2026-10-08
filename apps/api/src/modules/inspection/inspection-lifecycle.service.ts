import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { ContractStatus, InspectionType, StorageUnitStatus } from '@storage/types';
import { DataSource, type EntityManager, In } from 'typeorm';
import { assertInspectorOrManager, assertNotFinalized } from './inspection-access.util';

interface Transition {
  contractFrom: ContractStatus;
  contractTo: ContractStatus;
  /** Contract date stamped with the finalize time. */
  stamp: 'signedAt' | 'endedAt';
  unitFrom: StorageUnitStatus[];
  unitTo: (inspection: Inspection) => StorageUnitStatus;
}

const TRANSITIONS: Partial<Record<InspectionType, Transition>> = {
  // Handover: HELD covers bookings confirmed before units moved to BOOKED on deposit.
  [InspectionType.PRE_HANDOVER]: {
    contractFrom: ContractStatus.DRAFT,
    contractTo: ContractStatus.ACTIVE,
    stamp: 'signedAt',
    unitFrom: [StorageUnitStatus.BOOKED, StorageUnitStatus.HELD],
    unitTo: () => StorageUnitStatus.RENTED,
  },
  // Return: recorded damage keeps the unit out of rotation until it is repaired.
  [InspectionType.RETURN]: {
    contractFrom: ContractStatus.ACTIVE,
    contractTo: ContractStatus.ENDED,
    stamp: 'endedAt',
    unitFrom: [StorageUnitStatus.RENTED],
    unitTo: (inspection) =>
      inspection.damages?.length ? StorageUnitStatus.MAINTENANCE : StorageUnitStatus.AVAILABLE,
  },
};

@Injectable()
export class InspectionLifecycleService {
  private readonly logger = new Logger(InspectionLifecycleService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Signs off an inspection and moves the contract and unit along with it:
   * handover DRAFT → ACTIVE / unit RENTED, return ACTIVE → ENDED / unit AVAILABLE or
   * MAINTENANCE. Everything changes in one transaction under row locks, so a concurrent
   * finalize sees the committed finalizedAt and gets 409.
   */
  async finalize(id: string, actor: AuthUser): Promise<Inspection> {
    return this.dataSource.transaction(async (em) => {
      const inspection = await em.findOne(Inspection, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!inspection) notFound('Inspection', id);
      await assertInspectorOrManager(
        em,
        inspection,
        actor,
        'Only the assigned inspector or a manager can finalize this inspection',
      );
      assertNotFinalized(inspection);
      if (!inspection.inspectedBy) {
        throw conflict('Assign an inspector before finalizing', { inspectionId: id });
      }
      const transition = TRANSITIONS[inspection.type];
      if (!transition) {
        throw conflict(`${inspection.type} inspections cannot be finalized`, {
          inspectionId: id,
          type: inspection.type,
        });
      }

      const contract = await em.findOne(Contract, {
        where: { id: inspection.contractId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contract) notFound('Contract', inspection.contractId);
      if (contract.status !== transition.contractFrom) {
        throw conflict(`${inspection.type} requires a ${transition.contractFrom} contract`, {
          contractId: contract.id,
          status: contract.status,
          requiredStatus: transition.contractFrom,
        });
      }

      await this.moveUnit(em, contract, transition, inspection);
      const now = new Date();
      await em.update(
        Contract,
        { id: contract.id },
        { status: transition.contractTo, [transition.stamp]: now },
      );
      inspection.finalizedAt = now;
      inspection.inspectedAt ??= now;
      const saved = await em.save(Inspection, inspection);
      this.logger.log(
        `${inspection.type} ${id} finalized — contract ${contract.contractNo} ${transition.contractTo}`,
      );
      return saved;
    });
  }

  private async moveUnit(
    em: EntityManager,
    contract: Contract,
    transition: Transition,
    inspection: Inspection,
  ): Promise<void> {
    const item = await em.findOneOrFail(BookingItem, { where: { id: contract.bookingItemId } });
    const result = await em.update(
      StorageUnit,
      { id: item.storageUnitId, status: In(transition.unitFrom) },
      { status: transition.unitTo(inspection) },
    );
    if (result.affected) return;
    const unit = await em.findOne(StorageUnit, { where: { id: item.storageUnitId } });
    throw conflict('The storage unit is not in the expected state for this contract', {
      storageUnitId: item.storageUnitId,
      status: unit?.status ?? null,
      expected: transition.unitFrom,
    });
  }
}

function conflict(message: string, details: Record<string, unknown>): DomainException {
  return new DomainException(ErrorCode.CONFLICT, message, HttpStatus.CONFLICT, details);
}
