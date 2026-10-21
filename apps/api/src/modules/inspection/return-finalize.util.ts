import type { Contract } from '@entities/contract.entity';
import type { Inspection } from '@entities/inspection.entity';
import type { Invoice } from '@entities/invoice.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { captureDepositSafely } from '@modules/contracts/deposit-ledger.util';
import {
  issueRentPeriodInvoice,
  type RentPeriodUnit,
  recurringRentPeriods,
} from '@modules/invoices/rent-period-invoice.util';
import type { NotificationsService } from '@modules/notifications/notifications.service';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import { effectiveReturnDay } from '@modules/settlements/return-timing';
import {
  type VoidedInvoice,
  voidUnstartedInvoices,
} from '@modules/settlements/unstarted-invoices.util';
import { fieldValidationError } from '@shared/exceptions/domain.exception';
import {
  formatVietnamDate,
  fromVietnamDate,
  vietnamDate,
  vietnamToday,
} from '@shared/utils/calendar.util';
import { InspectionType, NotificationType } from '@storage/types';
import type { EntityManager } from 'typeorm';

/**
 * The day the unit actually came back, for a return: the day staff picked, or today when they
 * picked none (older clients send no body). It cannot precede the request nor be in the future.
 * Handovers have no such day.
 */
export function resolveReturnedOn(
  inspection: Inspection,
  requested: string | undefined,
  now: Date,
): string | null {
  if (inspection.type !== InspectionType.RETURN) {
    if (requested === undefined) return null;
    throw fieldValidationError(
      'returnedOn',
      'returnOnly',
      'Chỉ biên trả kho mới có ngày trả thực tế',
    );
  }
  const today = vietnamToday(now);
  const requestedDay = vietnamDate(inspection.createdAt);
  const day = requested ?? today;
  if (day < requestedDay || day > today) {
    throw fieldValidationError(
      'returnedOn',
      'outOfRange',
      `Ngày trả thực tế phải từ ${formatVietnamDate(requestedDay)} đến hôm nay`,
    );
  }
  return day;
}

export function returnFinalizedNotification(
  contract: Pick<Contract, 'id' | 'contractNo'>,
  inspection: Pick<Inspection, 'id'>,
  unitCode: string | null,
  returnedOn: string,
): NotificationPayload {
  const unit = unitCode ? `kho ${unitCode}` : `kho của hợp đồng ${contract.contractNo}`;
  return {
    type: NotificationType.RETURN_FINALIZED,
    title: 'Đã chốt biên trả kho',
    body: `Đã chốt biên trả ${unit}; tiền cọc đang được quyết toán`,
    data: {
      contractId: contract.id,
      contractNo: contract.contractNo,
      inspectionId: inspection.id,
      returnedOn,
    },
  };
}

export interface ReturnFinalizeInput {
  inspection: Inspection;
  contract: Contract;
  storageUnitId: string;
  returnedOn: string;
  notifications: NotificationsService;
  /** Finalize time, stamped on the invoices issued now. */
  now?: Date;
}

export interface ReturnFinalizeResult {
  effectiveReturnDay: string;
  /** Rent periods owed before the effective day that had no invoice yet. */
  issuedInvoices: Invoice[];
  voidedInvoices: VoidedInvoice[];
}

/**
 * Invoices the rent periods that started before `countedTo` but were never billed. The daily run
 * bills a period only from a few days before it starts and only while the contract is active, so
 * a customer handing the unit back before the appointment would otherwise never be billed for a
 * period starting in between. Periods stop at the end of the term: an overstay is charged as a
 * penalty, never as an extra period.
 */
export async function issueOwedRentPeriods(
  em: EntityManager,
  contract: Contract,
  unit: RentPeriodUnit | null,
  countedTo: string,
  now: Date,
  notifications: NotificationsService,
): Promise<Invoice[]> {
  const before = fromVietnamDate(countedTo).getTime();
  const issued: Invoice[] = [];
  for (const period of recurringRentPeriods(contract)) {
    if (period.startAt.getTime() >= before) break;
    const invoice = await issueRentPeriodInvoice(em, contract, unit, period, now, notifications);
    if (invoice) issued.push(invoice);
  }
  return issued;
}

/**
 * What a finalized return settles besides the unit, on the finalize transaction, while the
 * contract is still ACTIVE (the caller ends it afterwards) and its row is locked:
 * 1. the actual return day is recorded; money counts to the later of it and the appointment;
 * 2. periods starting before that day that were never invoiced are invoiced;
 * 3. only then are periods starting on or after it voided — a strictly later set, so nothing
 *    issued in step 2 is voided;
 * 4. the deposit ledger row is recorded if still missing, never blocking the finalize;
 * 5. the customer is told the deposit is being settled.
 * Locks follow inspection → contract → invoices → deposit.
 */
export async function applyReturnFinalize(
  em: EntityManager,
  input: ReturnFinalizeInput,
): Promise<ReturnFinalizeResult> {
  const { inspection, contract, returnedOn, notifications } = input;
  inspection.returnedOn = returnedOn;
  const scheduledDay = inspection.scheduledAt ? vietnamDate(inspection.scheduledAt) : returnedOn;
  const countedTo = effectiveReturnDay(scheduledDay, returnedOn);
  const unit = await em.findOne(StorageUnit, { where: { id: input.storageUnitId } });

  const issuedInvoices = await issueOwedRentPeriods(
    em,
    contract,
    unit,
    countedTo,
    input.now ?? new Date(),
    notifications,
  );
  const voidedInvoices = await voidUnstartedInvoices(em, contract.id, countedTo);
  await captureDepositSafely(em, contract);
  await notifications.createForUsers(
    em,
    [contract.customerId],
    returnFinalizedNotification(contract, inspection, unit?.code ?? null, returnedOn),
  );
  return { effectiveReturnDay: countedTo, issuedInvoices, voidedInvoices };
}
