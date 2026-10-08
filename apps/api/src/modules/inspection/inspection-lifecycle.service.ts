import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { ContractStatus, InspectionType, StorageUnitStatus } from '@storage/types';
import { DataSource, In } from 'typeorm';
import { assertInspectorOrManager, assertNotFinalized } from './inspection-access.util';

/** Units reserved for a not-yet-handed-over contract (HELD covers bookings confirmed before BOOKED existed). */
const RESERVED_UNIT_STATUSES = [StorageUnitStatus.BOOKED, StorageUnitStatus.HELD];

@Injectable()
export class InspectionLifecycleService {
  private readonly logger = new Logger(InspectionLifecycleService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Signs off an inspection. Handover (PRE_HANDOVER): the contract DRAFT → ACTIVE with
   * signedAt = now and the unit → RENTED. All rows change in one transaction under row
   * locks, so a concurrent finalize sees the committed finalizedAt and gets 409.
   */
  async finalize(id: string, actor: AuthUser): Promise<Inspection> {
    return this.dataSource.transaction(async (em) => {
      const inspection = await em.findOne(Inspection, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!inspection) notFound('Inspection', id);
      assertInspectorOrManager(
        inspection,
        actor,
        'Only the assigned inspector or a manager can finalize this inspection',
      );
      assertNotFinalized(inspection);
      if (!inspection.inspectedBy) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Assign an inspector before finalizing',
          HttpStatus.CONFLICT,
          { inspectionId: id },
        );
      }
      if (inspection.type !== InspectionType.PRE_HANDOVER) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          `Finalizing ${inspection.type} inspections is not supported yet`,
          HttpStatus.CONFLICT,
          { inspectionId: id, type: inspection.type },
        );
      }

      const contract = await em.findOne(Contract, {
        where: { id: inspection.contractId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contract) notFound('Contract', inspection.contractId);
      if (contract.status !== ContractStatus.DRAFT) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Handover requires a DRAFT contract',
          HttpStatus.CONFLICT,
          {
            contractId: contract.id,
            status: contract.status,
            requiredStatus: ContractStatus.DRAFT,
          },
        );
      }

      const item = await em.findOneOrFail(BookingItem, { where: { id: contract.bookingItemId } });
      const unitUpdate = await em.update(
        StorageUnit,
        { id: item.storageUnitId, status: In(RESERVED_UNIT_STATUSES) },
        { status: StorageUnitStatus.RENTED },
      );
      if (!unitUpdate.affected) {
        const unit = await em.findOne(StorageUnit, { where: { id: item.storageUnitId } });
        throw new DomainException(
          ErrorCode.CONFLICT,
          'The storage unit is not reserved for this contract',
          HttpStatus.CONFLICT,
          { storageUnitId: item.storageUnitId, status: unit?.status ?? null },
        );
      }

      const now = new Date();
      await em.update(
        Contract,
        { id: contract.id },
        { status: ContractStatus.ACTIVE, signedAt: now },
      );
      inspection.finalizedAt = now;
      inspection.inspectedAt ??= now;
      const saved = await em.save(Inspection, inspection);
      this.logger.log(`Handover ${id} finalized — contract ${contract.contractNo} ACTIVE`);
      return saved;
    });
  }
}
