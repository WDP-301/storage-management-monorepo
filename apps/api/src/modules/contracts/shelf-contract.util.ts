import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { Invoice } from '@entities/invoice.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import type { NotificationsService } from '@modules/notifications/notifications.service';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import { HttpStatus, type Logger } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { addVietnamCalendarMonths, formatVietnamDate } from '@shared/utils/calendar.util';
import {
  ContractStatus,
  InspectionType,
  InvoiceStatus,
  NotificationType,
  StorageUnitKind,
  StorageUnitStatus,
} from '@storage/types';
import { type EntityManager, In, IsNull } from 'typeorm';
import { findFirstRentInvoice } from './first-rent.util';
import { issueFirstRentInvoice } from './first-rent-issue.util';
import { type PersistContractInput, persistContract } from './initial-contract.util';
import { lockUnitClaimedOnlyBy } from './unit-claim.util';

export async function isShelfUnit(em: EntityManager, storageUnitId: string): Promise<boolean> {
  const unit = await em.findOne(StorageUnit, { where: { id: storageUnitId } });
  return unit?.kind === StorageUnitKind.SHELF;
}

export async function isShelfContract(em: EntityManager, contractId: string): Promise<boolean> {
  const contract = await em.findOne(Contract, {
    where: { id: contractId },
    relations: { bookingItem: { storageUnit: true } },
  });
  return contract?.bookingItem?.storageUnit?.kind === StorageUnitKind.SHELF;
}

/**
 * The contract a booking item is rented under. A shelf gets no handover: the customer never
 * handles the shelf, so its first month is billed at once and the contract turns ACTIVE when
 * that is paid and the signed files are in (`activateShelfContract`).
 */
export async function persistBookedContract(
  em: EntityManager,
  input: PersistContractInput,
  notifications: NotificationsService,
): Promise<Contract> {
  const shelf = await isShelfUnit(em, input.item.storageUnitId);
  const contract = await persistContract(em, { ...input, handover: !shelf });
  if (shelf && contract.status === ContractStatus.DRAFT) {
    await issueFirstRentInvoice(em, contract, notifications);
  }
  return contract;
}

function contractActivatedNotification(
  contract: Pick<Contract, 'id' | 'contractNo'>,
  shelfCode: string | null,
  effectiveAt: Date,
): NotificationPayload {
  return {
    type: NotificationType.CONTRACT_ACTIVATED,
    title: 'Hợp đồng kệ đã có hiệu lực',
    body:
      `Kệ ${shelfCode ?? contract.contractNo} dùng được từ ${formatVietnamDate(effectiveAt)}. ` +
      'Mở mã QR trong app khi tới quầy gửi đồ.',
    data: { contractId: contract.id, contractNo: contract.contractNo },
  };
}

export type ShelfActivation = 'activated' | 'not-applicable' | 'not-ready';

/**
 * Turns a DRAFT shelf contract ACTIVE once it holds the signed files and its first month is paid,
 * whichever came last; otherwise changes nothing. The term starts now but never before the booked
 * start, so a customer who settles late is not billed for days they did not have the shelf, and
 * the first month is re-dated to it. A contract that has a handover inspection (made before
 * shelves dropped it, or a unit change's destination) still goes through that handover.
 * Locks contract → first-month invoice → unit, the handover finalize's order.
 */
export async function activateShelfContract(
  em: EntityManager,
  contractId: string,
  notifications: NotificationsService,
  now: Date = new Date(),
): Promise<ShelfActivation> {
  const contract = await em.findOne(Contract, {
    where: { id: contractId, deletedAt: IsNull() },
    lock: { mode: 'pessimistic_write' },
  });
  if (contract?.status !== ContractStatus.DRAFT) return 'not-applicable';
  const item = await em.findOne(BookingItem, {
    where: { id: contract.bookingItemId },
    relations: { storageUnit: true },
  });
  if (!item || item.storageUnit?.kind !== StorageUnitKind.SHELF) return 'not-applicable';
  if (await em.exists(Inspection, { where: { contractId, type: InspectionType.PRE_HANDOVER } })) {
    return 'not-applicable';
  }
  if (!contract.documents?.length) return 'not-ready';
  const invoice = await findFirstRentInvoice(em, contractId, { lock: true });
  if (invoice?.status !== InvoiceStatus.PAID) return 'not-ready';

  // BOOKED/HELD do not say for whom — never give the shelf to a contract another booking claims.
  const unit = await lockUnitClaimedOnlyBy(em, item);
  const moved = await em.update(
    StorageUnit,
    { id: unit.id, status: In([StorageUnitStatus.BOOKED, StorageUnitStatus.HELD]) },
    { status: StorageUnitStatus.RENTED },
  );
  if (!moved.affected) {
    throw new DomainException(
      ErrorCode.CONFLICT,
      'The shelf is not in the expected state for this contract',
      HttpStatus.CONFLICT,
      { storageUnitId: unit.id, status: unit.status },
    );
  }

  const effectiveAt = new Date(Math.max(now.getTime(), new Date(contract.effectiveAt).getTime()));
  await em.update(
    Invoice,
    { id: invoice.id },
    { startAt: effectiveAt, endAt: addVietnamCalendarMonths(effectiveAt, invoice.months) },
  );
  await em.update(
    Contract,
    { id: contract.id },
    { status: ContractStatus.ACTIVE, signedAt: now, effectiveAt },
  );
  await notifications.createForUsers(
    em,
    [contract.customerId],
    contractActivatedNotification(contract, unit.code ?? null, effectiveAt),
  );
  return 'activated';
}

/**
 * `activateShelfContract` inside a savepoint that never throws: whatever triggered it (files
 * saved, money recorded) must stand even when the shelf cannot be activated; staff retry by
 * saving the files again.
 */
export async function activateShelfContractSafely(
  em: EntityManager,
  contractId: string,
  notifications: NotificationsService,
  logger: Logger,
): Promise<ShelfActivation | null> {
  try {
    const outcome = await em.transaction((savepoint) =>
      activateShelfContract(savepoint, contractId, notifications),
    );
    if (outcome === 'activated') logger.log(`Shelf contract ${contractId} activated`);
    return outcome;
  } catch (err) {
    logger.error(
      `Activating shelf contract ${contractId} failed; left DRAFT`,
      err instanceof Error ? err.stack : String(err),
    );
    return null;
  }
}
