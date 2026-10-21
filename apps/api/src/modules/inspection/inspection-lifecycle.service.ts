import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { Invoice } from '@entities/invoice.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { lockUnitClaimedOnlyBy } from '@modules/contracts/unit-claim.util';
import { queueInvoicePdf } from '@modules/invoices/rent-period-invoice.util';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { QueueService } from '@modules/queue/queue.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { ContractStatus, DamageSeverity, InspectionType, StorageUnitStatus } from '@storage/types';
import { DataSource, type EntityManager, In } from 'typeorm';
import type { FinalizeInspectionDto } from './dto/finalize-inspection.dto';
import { assertReadyForHandover } from './handover-ready.util';
import {
  assertInspectorOrManager,
  assertNotFinalized,
  withoutRefundAccount,
} from './inspection-access.util';
import { applyReturnFinalize, resolveReturnedOn } from './return-finalize.util';

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
  // Return: only major damage takes the unit out of rotation for repair. Minor damage stays on
  // the return record for staff to handle while the unit is rented out again.
  [InspectionType.RETURN]: {
    contractFrom: ContractStatus.ACTIVE,
    contractTo: ContractStatus.ENDED,
    stamp: 'endedAt',
    unitFrom: [StorageUnitStatus.RENTED],
    unitTo: (inspection) =>
      inspection.damages?.some((damage) => damage?.severity === DamageSeverity.MAJOR)
        ? StorageUnitStatus.MAINTENANCE
        : StorageUnitStatus.AVAILABLE,
  },
};

@Injectable()
export class InspectionLifecycleService {
  private readonly logger = new Logger(InspectionLifecycleService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
    private readonly queue: QueueService,
  ) {}

  /**
   * Signs off an inspection and moves the contract and unit along with it (a handover first
   * needs the signed files and the first month paid):
   * handover DRAFT → ACTIVE / unit RENTED, return ACTIVE → ENDED / unit AVAILABLE or
   * MAINTENANCE, with the actual return day (default today) and the rent it still owes billed.
   * Everything changes in one transaction under row locks, so a concurrent finalize sees the
   * committed finalizedAt (409). PDFs of invoices it issued are queued once committed.
   */
  async finalize(
    id: string,
    actor: AuthUser,
    dto: FinalizeInspectionDto = {},
  ): Promise<Inspection> {
    const { finalized, issuedInvoiceIds } = await this.dataSource.transaction(async (em) => {
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
      const now = new Date();
      const returnedOn = resolveReturnedOn(inspection, dto.returnedOn, now);

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

      const firstRent =
        inspection.type === InspectionType.PRE_HANDOVER
          ? await assertReadyForHandover(em, contract)
          : null;

      const storageUnitId = await this.moveUnit(em, contract, transition, inspection);
      // The first paid month runs from the day the customer actually took the unit.
      if (firstRent) {
        const endAt = new Date(now);
        endAt.setMonth(endAt.getMonth() + firstRent.months);
        await em.update(Invoice, { id: firstRent.id }, { startAt: now, endAt });
      }
      // Before the contract ends: rent still owed is billed on an ACTIVE contract.
      const settled = returnedOn
        ? await applyReturnFinalize(em, {
            inspection,
            contract,
            storageUnitId,
            returnedOn,
            notifications: this.notifications,
            now,
          })
        : null;
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
      const issuedInvoiceIds = settled?.issuedInvoices.map((invoice) => invoice.id) ?? [];
      return { finalized: withoutRefundAccount(saved), issuedInvoiceIds };
    });
    for (const invoiceId of issuedInvoiceIds) {
      // Committed already; a failure only delays the PDF, as with the daily billing run.
      await queueInvoicePdf(this.queue, invoiceId).catch((err: unknown) =>
        this.logger.error(`Queueing the PDF of invoice ${invoiceId} failed`, String(err)),
      );
    }
    return finalized;
  }

  private async moveUnit(
    em: EntityManager,
    contract: Contract,
    transition: Transition,
    inspection: Inspection,
  ): Promise<string> {
    const item = await em.findOneOrFail(BookingItem, { where: { id: contract.bookingItemId } });
    // BOOKED/HELD do not say for whom — never hand over a unit another booking claims.
    if (inspection.type === InspectionType.PRE_HANDOVER) await lockUnitClaimedOnlyBy(em, item);
    const result = await em.update(
      StorageUnit,
      { id: item.storageUnitId, status: In(transition.unitFrom) },
      { status: transition.unitTo(inspection) },
    );
    if (result.affected) return item.storageUnitId;
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
