import type { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { UnitChangeRequest } from '@entities/unit-change-request.entity';
import { officeTimeProblem } from '@modules/bookings/receiving-window.util';
import type { SettingsService } from '@modules/settings/settings.service';
import type { ShiftWindow } from '@modules/shift-templates/shift-time';
import { HttpStatus } from '@nestjs/common';
import { DomainException, fieldValidationError } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { addVietnamDays, vietnamDate, vietnamToday } from '@shared/utils/calendar.util';
import {
  ChangeRequestStatus,
  ContractStatus,
  InspectionType,
  type RefundBankAccount,
  type ReturnRequestSource,
  type ReturnRules,
} from '@storage/types';
import { type EntityManager, In, IsNull } from 'typeorm';

/** How far ahead a return can be booked, in days. */
export const RETURN_MAX_DAYS_AHEAD = 365;

export const RETURN_MESSAGES = {
  notActive: 'Chỉ hợp đồng đang thuê mới yêu cầu trả kho được',
  alreadyOpen: 'Hợp đồng đã có yêu cầu trả kho đang mở',
  changeInProgress: 'Hợp đồng đang có yêu cầu đổi kho — huỷ hoặc hoàn tất đổi kho trước khi trả',
  finalized: 'Biên trả đã chốt — không sửa được',
  locked: 'Chi nhánh đã bắt đầu kiểm tra kho — không huỷ được yêu cầu trả kho',
  notFound: 'Không tìm thấy yêu cầu trả kho đang mở',
  dayOutOfRange: `Chọn ngày trả trong khoảng từ hôm nay đến ${RETURN_MAX_DAYS_AHEAD} ngày tới`,
  pastTime: 'Giờ trả kho phải ở tương lai',
  notInShift: 'Giờ trả kho phải nằm trong khung giờ hành chính',
} as const;

/** A unit change in any of these statuses still owns the contract's right to keep moving. */
export const OPEN_CHANGE_STATUSES: readonly ChangeRequestStatus[] = [
  ChangeRequestStatus.REQUESTED,
  ChangeRequestStatus.AWAITING_PAYMENT,
  ChangeRequestStatus.AWAITING_HANDOVER,
  ChangeRequestStatus.AWAITING_FINAL_APPROVAL,
];

export function returnConflict(
  message: string,
  details: Record<string, unknown>,
  code: ErrorCode = ErrorCode.CONFLICT,
): DomainException {
  return new DomainException(code, message, HttpStatus.CONFLICT, details);
}

/** 400 unless `at` falls on a Vietnam day from today to RETURN_MAX_DAYS_AHEAD days ahead. */
export function assertReturnDayInRange(field: string, at: Date, now: Date = new Date()): void {
  const day = vietnamDate(at);
  const today = vietnamToday(now);
  if (day < today || day > addVietnamDays(today, RETURN_MAX_DAYS_AHEAD)) {
    throw fieldValidationError(field, 'outOfRange', RETURN_MESSAGES.dayOutOfRange);
  }
}

/**
 * 400 unless `at` is in the future and inside an OFFICE work-shift window: staff meet the
 * customer to inspect the unit, so the appointment is assigned to whoever is on shift then.
 */
export function assertReturnTimeInOfficeShift(
  field: string,
  at: Date,
  templates: readonly ShiftWindow[],
  now: Date = new Date(),
): void {
  const problem = officeTimeProblem(at, templates, now);
  if (problem === 'pastTime')
    throw fieldValidationError(field, 'pastTime', RETURN_MESSAGES.pastTime);
  if (problem === 'notInShift') {
    throw fieldValidationError(field, 'returnTimeNotInShift', RETURN_MESSAGES.notInShift);
  }
}

/** Staff wrote something on the return, so it is now part of the inspection record. */
export const staffStarted = (inspection: Inspection): boolean =>
  (inspection.evidence?.length ?? 0) > 0 ||
  (inspection.damages?.length ?? 0) > 0 ||
  Boolean(inspection.conditionNotes?.trim()) ||
  inspection.inspectedAt != null;

/** The return rules in force now, to be captured on a return request. */
export async function currentReturnRules(settings: SettingsService): Promise<ReturnRules> {
  const [noticeDays, penaltyPercent] = await Promise.all([
    settings.getReturnNoticeDays(),
    settings.getOverduePenaltyPercent(),
  ]);
  return { noticeDays, penaltyPercent };
}

export function assertContractActive(contract: Contract): void {
  if (contract.status !== ContractStatus.ACTIVE) {
    throw returnConflict(RETURN_MESSAGES.notActive, {
      contractId: contract.id,
      status: contract.status,
      requiredStatus: ContractStatus.ACTIVE,
    });
  }
}

export interface OpenReturnInput {
  scheduledAt: Date;
  note?: string | null;
  refundAccount?: RefundBankAccount | null;
  rules: ReturnRules;
  requestedBy: string;
  source: ReturnRequestSource;
  now: Date;
}

/**
 * Opens a RETURN inspection for staff to carry out on the requested day. The caller holds the
 * contract row lock, which serializes concurrent requests so at most one return is open per
 * contract. The notice runs from now, under the rules in force now.
 */
export async function openReturnInspection(
  em: EntityManager,
  contract: Contract,
  input: OpenReturnInput,
): Promise<Inspection> {
  assertContractActive(contract);
  const open = await em.findOne(Inspection, {
    where: { contractId: contract.id, type: InspectionType.RETURN, finalizedAt: IsNull() },
  });
  if (open) {
    throw returnConflict(RETURN_MESSAGES.alreadyOpen, {
      contractId: contract.id,
      inspectionId: open.id,
    });
  }
  // A move in flight owns the contract's destination — a return now would strand its held
  // unit and any billed deposit top-up. The caller's contract lock serializes this check
  // against decide/complete, which take the same lock.
  const openChange = await em.findOne(UnitChangeRequest, {
    where: { contractId: contract.id, status: In([...OPEN_CHANGE_STATUSES]) },
  });
  if (openChange) {
    throw returnConflict(RETURN_MESSAGES.changeInProgress, {
      contractId: contract.id,
      requestId: openChange.id,
      requestStatus: openChange.status,
    });
  }
  return em.save(
    Inspection,
    em.create(Inspection, {
      contractId: contract.id,
      type: InspectionType.RETURN,
      scheduledAt: input.scheduledAt,
      requestNote: input.note?.trim() || undefined,
      noticeFrom: input.now,
      returnRules: input.rules,
      refundAccount: input.refundAccount ?? null,
      requestedBy: input.requestedBy,
      requestSource: input.source,
    }),
  );
}

/** Whether `scheduledAt` is another instant than the current appointment (day or time). */
export function changesAppointment(inspection: Inspection, scheduledAt: Date): boolean {
  return inspection.scheduledAt?.getTime() !== scheduledAt.getTime();
}

/**
 * A requested appointment for an open return, checked and applied; returns whether it moved. The
 * appointment is only a schedule: money counts to the day the return is finalized, so moving it
 * changes no notice or rent. Sending back the appointment it already has is not a move: it is
 * accepted even once that time is behind us, so a form that resends every field never fails on
 * an old appointment. A move must land on a future in-shift time — staff are assigned by it.
 */
export function moveReturn(
  inspection: Inspection,
  scheduledAt: Date,
  templates: readonly ShiftWindow[],
  now: Date,
): boolean {
  if (!changesAppointment(inspection, scheduledAt)) return false;
  assertReturnDayInRange('scheduledAt', scheduledAt, now);
  assertReturnTimeInOfficeShift('scheduledAt', scheduledAt, templates, now);
  inspection.scheduledAt = scheduledAt;
  return true;
}
