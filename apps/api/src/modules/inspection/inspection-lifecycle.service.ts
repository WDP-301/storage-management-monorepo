import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { Invoice } from '@entities/invoice.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { isAssignmentActive } from '@modules/auth/role-assignment.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { advanceChangeRequestToFinalApproval } from '@modules/change-requests/change-request-handover.util';
import { lockUnitClaimedOnlyBy } from '@modules/contracts/unit-claim.util';
import { queueInvoicePdf } from '@modules/invoices/rent-period-invoice.util';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { QueueService } from '@modules/queue/queue.service';
import {
  assertShelfEmpty,
  cancelOpenDropOffRequests,
  cancelOpenPickupRequests,
} from '@modules/shelf-storage/shelf-empty-guard.util';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import {
  ContractStatus,
  DamageSeverity,
  InspectionType,
  NotificationType,
  StorageUnitStatus,
  UserRole,
} from '@storage/types';
import { DataSource, type EntityManager, In } from 'typeorm';
import { HandoverAssignmentService } from './handover-assignment/handover-assignment.service';
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
  /** Contract date stamped with the finalize time (only when the status actually changes). */
  stamp?: 'signedAt' | 'endedAt';
  unitFrom: StorageUnitStatus[];
  unitTo: (inspection: Inspection) => StorageUnitStatus;
  /** When true the finalize records the inspection only and leaves the unit alone. */
  skipUnit?: boolean;
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
  // Maintenance check of a unit vacated by a unit change: the old contract is already CANCELLED and
  // stays so. The staff only records the check — reopening the warehouse (MAINTENANCE → AVAILABLE)
  // is the manager's decision, made from the warehouse status control.
  [InspectionType.MAINTENANCE]: {
    contractFrom: ContractStatus.CANCELLED,
    contractTo: ContractStatus.CANCELLED,
    unitFrom: [StorageUnitStatus.MAINTENANCE],
    unitTo: () => StorageUnitStatus.MAINTENANCE,
    skipUnit: true,
  },
};

@Injectable()
export class InspectionLifecycleService {
  private readonly logger = new Logger(InspectionLifecycleService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
    private readonly queue: QueueService,
    private readonly handoverAssignment: HandoverAssignmentService,
  ) {}

  /**
   * Signs off an inspection and moves the contract and unit along with it (a handover first
   * needs the signed files and the first month paid):
   * handover DRAFT → ACTIVE / unit RENTED, return ACTIVE → ENDED / unit AVAILABLE or
   * MAINTENANCE, recorded on the day it is finalized, with the rent it still owes billed.
   * Everything changes in one transaction under row locks, so a concurrent finalize sees the
   * committed finalizedAt (409). PDFs of invoices it issued are queued once committed.
   */
  async finalize(id: string, actor: AuthUser): Promise<Inspection> {
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
      const returnedOn = resolveReturnedOn(inspection, now);

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
      // Goods left on a shelf must be handed back first; open requests die with the contract.
      if (inspection.type === InspectionType.RETURN) {
        await assertShelfEmpty(em, contract.id, 'RETURN');
        await cancelOpenPickupRequests(em, contract.id);
        await cancelOpenDropOffRequests(em, contract.id);
      }

      const firstRent =
        inspection.type === InspectionType.PRE_HANDOVER
          ? await assertReadyForHandover(em, contract)
          : null;

      const storageUnitId = transition.skipUnit
        ? (await em.findOneOrFail(BookingItem, { where: { id: contract.bookingItemId } }))
            .storageUnitId
        : await this.moveUnit(em, contract, transition, inspection);
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
      if (transition.contractTo !== transition.contractFrom) {
        await em.update(
          Contract,
          { id: contract.id },
          {
            status: transition.contractTo,
            ...(transition.stamp ? { [transition.stamp]: now } : {}),
          },
        );
      }
      // A unit change's destination contract turns ACTIVE here — hand it to the L2 queue.
      if (inspection.type === InspectionType.PRE_HANDOVER) {
        await advanceChangeRequestToFinalApproval(
          em,
          contract.id,
          now,
          this.notifications,
          this.handoverAssignment,
        );
      }
      if (inspection.type === InspectionType.MAINTENANCE) {
        await this.notifyMaintenanceCompleted(em, contract, inspection, storageUnitId);
      }
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

  /** Tells the old facility's managers the check is done so THEY decide whether to reopen the unit. */
  private async notifyMaintenanceCompleted(
    em: EntityManager,
    contract: Contract,
    inspection: Inspection,
    storageUnitId: string,
  ): Promise<void> {
    const unit = await em.findOne(StorageUnit, { where: { id: storageUnitId } });
    if (!unit) return;
    const assignments = await em.find(UserRoleAssignment, {
      where: { role: UserRole.FACILITY_MANAGER, facilityId: unit.facilityId },
    });
    const managerIds = [
      ...new Set(assignments.filter((a) => isAssignmentActive(a)).map((a) => a.userId)),
    ];
    if (managerIds.length === 0) return;
    const major = inspection.damages?.some((damage) => damage?.severity === DamageSeverity.MAJOR);
    await this.notifications.createForUsers(em, managerIds, {
      type: NotificationType.MAINTENANCE_COMPLETED,
      title: 'Đã kiểm tra kho cũ',
      body:
        `Kho ${unit.code} đã kiểm tra xong${major ? ' — phát hiện hư hỏng nặng' : ''}. ` +
        'Vào "Kho của chi nhánh" để quyết định mở lại kho.',
      data: {
        inspectionId: inspection.id,
        contractId: contract.id,
        unitId: unit.id,
        unitCode: unit.code,
        hasMajorDamage: major,
      },
    });
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
