import type { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import type { SettingsService } from '@modules/settings/settings.service';
import { HttpStatus } from '@nestjs/common';
import { DomainException, fieldValidationError } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { addVietnamDays, vietnamDate, vietnamToday } from '@shared/utils/calendar.util';
import {
  ContractStatus,
  InspectionType,
  type RefundBankAccount,
  type ReturnRequestSource,
  type ReturnRules,
} from '@storage/types';
import { type EntityManager, IsNull } from 'typeorm';

/** How far ahead a return can be booked, in days. */
export const RETURN_MAX_DAYS_AHEAD = 365;

export const RETURN_MESSAGES = {
  notActive: 'Chỉ hợp đồng đang thuê mới yêu cầu trả kho được',
  alreadyOpen: 'Hợp đồng đã có yêu cầu trả kho đang mở',
  finalized: 'Biên trả đã chốt — không sửa được',
  locked: 'Chi nhánh đã bắt đầu kiểm tra kho — không huỷ được yêu cầu trả kho',
  notFound: 'Không tìm thấy yêu cầu trả kho đang mở',
  dayOutOfRange: `Chọn ngày trả trong khoảng từ hôm nay đến ${RETURN_MAX_DAYS_AHEAD} ngày tới`,
} as const;

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

/**
 * Moves an open return to a new day. Bringing it forward restarts the notice from now (and
 * captures the rules if the request predates them), so booking a far-off day and then moving it
 * earlier cannot dodge the short-notice deduction; pushing it back keeps the original notice.
 */
export async function rescheduleReturn(
  inspection: Inspection,
  scheduledAt: Date,
  now: Date,
  loadRules: () => Promise<ReturnRules>,
): Promise<void> {
  const current = inspection.scheduledAt ? vietnamDate(inspection.scheduledAt) : null;
  if (current && vietnamDate(scheduledAt) < current) {
    inspection.noticeFrom = now;
    inspection.returnRules ??= await loadRules();
  }
  inspection.scheduledAt = scheduledAt;
}

/**
 * A requested appointment for an open return, checked and applied. Sending back the day it
 * already has (another time of that Vietnam day) is not a move: it is accepted even once that
 * day is behind us, so a form that resends every field never fails on an old appointment.
 */
export async function moveReturn(
  inspection: Inspection,
  scheduledAt: Date,
  now: Date,
  loadRules: () => Promise<ReturnRules>,
): Promise<void> {
  const sameDay =
    inspection.scheduledAt != null &&
    vietnamDate(inspection.scheduledAt) === vietnamDate(scheduledAt);
  if (!sameDay) assertReturnDayInRange('scheduledAt', scheduledAt, now);
  await rescheduleReturn(inspection, scheduledAt, now, loadRules);
}
