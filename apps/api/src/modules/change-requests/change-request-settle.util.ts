import { AppUser } from '@entities/app-user.entity';
import { Booking } from '@entities/booking.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { Invoice } from '@entities/invoice.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitChangeRequest } from '@entities/unit-change-request.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { isAssignmentActive } from '@modules/auth/role-assignment.util';
import { generateBookingNo } from '@modules/bookings/booking-no.util';
import { resolveContractDeposit } from '@modules/contracts/deposit-ledger.util';
import { topUpChangeRequestId } from '@modules/contracts/deposit-topup';
import { persistContract } from '@modules/contracts/initial-contract.util';
import type { HandoverAssignmentService } from '@modules/inspection/handover-assignment/handover-assignment.service';
import type { NotificationsService } from '@modules/notifications/notifications.service';
import { HttpStatus, Logger } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { vietnamDate } from '@shared/utils/calendar.util';
import {
  BookingStatus,
  ChangeRequestStatus,
  ContractStatus,
  FacilityStatus,
  InspectionType,
  InvoiceKind,
  InvoiceStatus,
  NotificationType,
  PaymentStatus,
  StorageUnitStatus,
  UserRole,
} from '@storage/types';
import Decimal from 'decimal.js';
import { type EntityManager, IsNull } from 'typeorm';

const logger = new Logger('ChangeRequestSettle');

/** The note written on the old contract when a move cancels it. */
export const UNIT_CHANGE_NOTE = 'khách đổi kho mới';

/** Statuses that mean the request was already settled — re-running is a no-op. */
const SETTLED_STATUSES: readonly ChangeRequestStatus[] = [
  ChangeRequestStatus.AWAITING_HANDOVER,
  ChangeRequestStatus.AWAITING_FINAL_APPROVAL,
  ChangeRequestStatus.COMPLETED,
];
const SETTLEABLE_STATUSES: readonly ChangeRequestStatus[] = [
  ChangeRequestStatus.REQUESTED,
  ChangeRequestStatus.AWAITING_PAYMENT,
];

export interface SettleDeps {
  handoverAssignment: HandoverAssignmentService;
  notifications: NotificationsService;
}

/** Sum of the succeeded payments on a top-up invoice; 0 when there is none. */
async function paidTopUpAmount(em: EntityManager, invoiceId?: string | null): Promise<Decimal> {
  if (!invoiceId) return new Decimal(0);
  const [row] = (await em.query(
    `SELECT COALESCE(sum("amount"), 0) AS paid FROM "payments"
      WHERE "invoice_id" = $1 AND "status" = $2`,
    [invoiceId, PaymentStatus.SUCCEEDED],
  )) as Array<{ paid: string }>;
  return new Decimal(row?.paid ?? 0);
}

async function notifyFacilityManagers(
  em: EntityManager,
  facilityId: string | undefined,
  notifications: NotificationsService,
  payload: { type: NotificationType; title: string; body: string; data: Record<string, unknown> },
): Promise<void> {
  if (!facilityId) return;
  const assignments = await em.find(UserRoleAssignment, {
    where: { role: UserRole.FACILITY_MANAGER, facilityId },
  });
  const userIds = [
    ...new Set(assignments.filter((a) => isAssignmentActive(a)).map((a) => a.userId)),
  ];
  if (userIds.length === 0) return;
  await notifications.createForUsers(em, userIds, payload);
}

/**
 * Settles a change request: cancels the old contract (no settlement — the held deposit carries
 * over), mints a destination contract for the new unit the booking way (a CONFIRMED booking + item
 * + DRAFT contract + PRE_HANDOVER inspection), claims the held unit, assigns the round-robin
 * handover staff, and moves the deposit row (+ the paid top-up) onto the destination contract.
 *
 * Runs inside the caller's transaction. Idempotent under the request row lock: an already-settled
 * request is returned untouched. Throws on refusal — the human-driven L1 path wants that; the
 * payment path wraps it in a savepoint (see `settleIfTopUpInvoicePaid`).
 */
export async function settleChangeRequest(
  em: EntityManager,
  requestId: string,
  deps: SettleDeps,
  options: { actorId: string | null; now?: Date },
): Promise<UnitChangeRequest> {
  const now = options.now ?? new Date();
  const actor = options.actorId ?? 'system';

  const request = await em.findOne(UnitChangeRequest, {
    where: { id: requestId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!request) notFound('Change request', requestId);
  if (SETTLED_STATUSES.includes(request.status)) return request;
  if (!SETTLEABLE_STATUSES.includes(request.status)) {
    throw new DomainException(
      ErrorCode.CONFLICT,
      `Request cannot be settled while its status is ${request.status}`,
      HttpStatus.CONFLICT,
      { requestId, status: request.status },
    );
  }
  if (!request.newUnitId) {
    throw new DomainException(
      ErrorCode.CONFLICT,
      'Request has no target unit to move into',
      HttpStatus.CONFLICT,
    );
  }

  const oldContract = await em.findOne(Contract, {
    where: { id: request.contractId, deletedAt: IsNull() },
    lock: { mode: 'pessimistic_write' },
  });
  if (!oldContract || oldContract.status !== ContractStatus.ACTIVE) {
    throw new DomainException(
      ErrorCode.CONFLICT,
      'Contract is no longer active',
      HttpStatus.CONFLICT,
    );
  }
  const oldItem = await em.findOne(BookingItem, { where: { id: oldContract.bookingItemId } });
  if (!oldItem || oldItem.storageUnitId !== request.oldUnitId) {
    throw new DomainException(
      ErrorCode.CONFLICT,
      'Contract has already moved to another warehouse',
      HttpStatus.CONFLICT,
    );
  }
  const openReturns = await em.count(Inspection, {
    where: { contractId: oldContract.id, type: InspectionType.RETURN, finalizedAt: IsNull() },
  });
  if (openReturns > 0) {
    throw new DomainException(
      ErrorCode.CONFLICT,
      'Contract has a return in progress',
      HttpStatus.CONFLICT,
    );
  }

  const target = await em.findOne(StorageUnit, {
    where: { id: request.newUnitId, deletedAt: IsNull() },
    relations: { facility: true },
  });
  if (!target || target.status !== StorageUnitStatus.HELD) {
    throw new DomainException(
      ErrorCode.CONFLICT,
      'Target unit is no longer held for this move',
      HttpStatus.CONFLICT,
    );
  }
  if (target.facility?.status !== FacilityStatus.ACTIVE) {
    throw new DomainException(
      ErrorCode.CONFLICT,
      'Target unit facility is not active',
      HttpStatus.CONFLICT,
    );
  }

  // The price/deposit the customer approved at L1 (a HELD unit's price stays editable, but the
  // billed top-up was quoted for these numbers, so they are the ones that carry over).
  const newPrice = new Decimal(oldItem.monthlyPriceSnapshot).plus(request.rentDifference);
  const newDeposit = new Decimal(oldItem.depositSnapshot).plus(request.depositDifference);

  // The old contract stays ACTIVE until the handover — the customer still rents the old unit — so
  // cancelling the move never costs them their contract. A paid top-up joins the deposit already
  // held FOR THE OLD contract; it moves to the destination contract only at handover.
  const topUpPaid = await paidTopUpAmount(em, request.topupInvoiceId);
  if (topUpPaid.gt(0)) {
    const oldDeposit = await resolveContractDeposit(em, oldContract, { create: true });
    if (oldDeposit) {
      await em.query(
        `UPDATE "deposits"
            SET "amount_snapshot" = "amount_snapshot" + $1,
                "held_amount" = "held_amount" + $1,
                "updated_at" = now()
          WHERE "id" = $2`,
        [topUpPaid.toFixed(2), oldDeposit.id],
      );
    } else {
      logger.warn(
        `Change request ${request.id}: the old deposit could not be derived; ` +
          `the paid top-up ${topUpPaid.toFixed(0)} is not on the ledger`,
      );
    }
  }

  const customer = await em.findOneOrFail(AppUser, { where: { id: oldContract.customerId } });
  const booking = await em.save(
    Booking,
    em.create(Booking, {
      bookingNo: generateBookingNo(),
      customerId: customer.id,
      status: BookingStatus.CONFIRMED,
      subtotal: newPrice.times(oldItem.rentalMonths).toFixed(2) as unknown as number,
      depositTotal: newDeposit.toFixed(2) as unknown as number,
    }),
  );
  const newItem = await em.save(
    BookingItem,
    em.create(BookingItem, {
      bookingId: booking.id,
      storageUnitId: request.newUnitId,
      requestedStartAt: request.moveAt ?? now,
      rentalMonths: oldItem.rentalMonths,
      monthlyPriceSnapshot: newPrice.toFixed(2) as unknown as number,
      depositSnapshot: newDeposit.toFixed(2) as unknown as number,
    }),
  );
  const newContract = await persistContract(em, {
    item: newItem,
    customer,
    status: ContractStatus.DRAFT,
    effectiveAt: request.moveAt ?? now,
    captureDeposit: false,
  });

  // The unit was held at L1; claim it for the destination contract.
  const claimed = await em.update(
    StorageUnit,
    { id: request.newUnitId, status: StorageUnitStatus.HELD },
    { status: StorageUnitStatus.BOOKED },
  );
  if (!claimed.affected) {
    throw new DomainException(
      ErrorCode.CONFLICT,
      'Target unit is no longer held for this move',
      HttpStatus.CONFLICT,
    );
  }

  await deps.handoverAssignment.assignSafely(em, booking.id);

  const from = request.status;
  request.status = ChangeRequestStatus.AWAITING_HANDOVER;
  request.newContractId = newContract.id;
  request.newBookingId = booking.id;
  request.settledAt = now;
  request.history = [
    ...(request.history ?? []),
    {
      action: 'STATUS_CHANGED',
      from,
      to: ChangeRequestStatus.AWAITING_HANDOVER,
      at: now.toISOString(),
      by: actor,
      contractId: newContract.id,
      bookingId: booking.id,
    },
  ];
  await em.save(UnitChangeRequest, request);

  const moveDay = request.moveAt ? vietnamDate(request.moveAt).split('-').reverse().join('/') : '';
  await deps.notifications.createForUsers(em, [customer.id], {
    type: NotificationType.UNIT_CHANGE_APPROVED,
    title: 'Yêu cầu đổi kho đã được duyệt',
    body:
      `Hợp đồng ${newContract.contractNo} đã được tạo cho kho ${target.code}` +
      (moveDay ? ` — bàn giao ngày ${moveDay}` : '') +
      '. Vui lòng mang theo giấy tờ khi bàn giao.',
    data: {
      requestId: request.id,
      contractId: newContract.id,
      newContractId: newContract.id,
      newUnitId: request.newUnitId,
      moveAt: request.moveAt?.toISOString(),
    },
  });
  await notifyFacilityManagers(em, target.facilityId, deps.notifications, {
    type: NotificationType.UNIT_CHANGE_APPROVED,
    title: 'Kho sắp nhận khách chuyển đến',
    body:
      `Kho ${target.code} đã tạo hợp đồng ${newContract.contractNo} cho khách chuyển đến` +
      (moveDay ? ` — bàn giao ngày ${moveDay}` : '') +
      '.',
    data: {
      requestId: request.id,
      contractId: newContract.id,
      newUnitId: request.newUnitId,
      moveAt: request.moveAt?.toISOString(),
    },
  });

  return request;
}

/**
 * Called after a DEPOSIT_TOPUP invoice flips to PAID. Runs the settle in a savepoint and never
 * throws: the money is recorded and the invoice is PAID, so a refusal must not roll back the
 * payment — the sweep retries it and a manager can settle by hand.
 */
export async function settleIfTopUpInvoicePaid(
  em: EntityManager,
  invoice: Invoice,
  deps: SettleDeps,
  actorId: string | null,
): Promise<void> {
  if (invoice.kind !== InvoiceKind.DEPOSIT_TOPUP) return;
  const requestId = await topUpChangeRequestId(em, invoice);
  if (!requestId) return;
  try {
    await em.transaction((savepoint) =>
      settleChangeRequest(savepoint, requestId, deps, { actorId }),
    );
  } catch (err) {
    logger.error(
      `Settling change request ${requestId} after top-up ${invoice.invoiceNo} failed; ` +
        'left for the sweep / a manager',
      err instanceof Error ? err.stack : String(err),
    );
  }
}

/**
 * Undoes a settled-but-unsigned move: the destination contract is still DRAFT, so it is cancelled
 * and its held unit returned. The OLD contract is left untouched — it stayed ACTIVE throughout, so
 * the customer keeps their contract and deposit.
 * Throws when the destination contract already went ACTIVE (signed) — then only a return can end it.
 */
export async function unwindSettledChangeRequest(
  em: EntityManager,
  request: Pick<UnitChangeRequest, 'contractId' | 'newContractId' | 'newUnitId' | 'topupInvoiceId'>,
): Promise<void> {
  if (request.newContractId) {
    const newContract = await em.findOne(Contract, {
      where: { id: request.newContractId },
      lock: { mode: 'pessimistic_write' },
    });
    if (newContract) {
      if (newContract.status !== ContractStatus.DRAFT) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Hợp đồng mới đã hiệu lực — dùng quy trình trả kho',
          HttpStatus.CONFLICT,
          { contractId: newContract.id, status: newContract.status },
        );
      }
      await em.update(
        Invoice,
        { contractId: newContract.id, status: InvoiceStatus.ISSUED },
        { status: InvoiceStatus.VOID },
      );
      await em.update(
        Contract,
        { id: newContract.id },
        { status: ContractStatus.CANCELLED, note: 'Huỷ do rút yêu cầu đổi kho' },
      );
    }
  }
  if (request.newUnitId) {
    await em.update(
      StorageUnit,
      { id: request.newUnitId, status: StorageUnitStatus.BOOKED },
      { status: StorageUnitStatus.AVAILABLE },
    );
  }
}

/** Whether a settled move can still run: destination contract DRAFT and its unit still claimed. */
export async function destinationStillRunnable(
  em: EntityManager,
  request: Pick<UnitChangeRequest, 'newContractId' | 'newUnitId'>,
): Promise<boolean> {
  if (!request.newContractId || !request.newUnitId) return false;
  const contract = await em.findOne(Contract, {
    where: { id: request.newContractId },
    lock: { mode: 'pessimistic_read' },
  });
  if (!contract || contract.status !== ContractStatus.DRAFT) return false;
  const unit = await em.findOne(StorageUnit, { where: { id: request.newUnitId } });
  return unit?.status === StorageUnitStatus.HELD || unit?.status === StorageUnitStatus.BOOKED;
}
