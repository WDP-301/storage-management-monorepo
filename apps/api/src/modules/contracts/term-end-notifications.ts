import { formatVndCurrency } from '@modules/invoices/invoice-pdf.service';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import { returnTiming } from '@modules/settlements/return-timing';
import {
  addVietnamDays,
  formatVietnamDate,
  vietnamDate,
  vietnamToday,
} from '@shared/utils/calendar.util';
import { NotificationType, type ReturnRules } from '@storage/types';

/** An active contract and, when the customer already asked to return, that open request. */
export interface TermEndCandidate {
  contractId: string;
  contractNo: string;
  customerId: string;
  unitCode: string;
  effectiveAt: Date;
  months: number;
  /** Monthly rent as stored (numeric columns arrive as strings). */
  monthlyPrice: string;
  openReturn: { scheduledAt: Date | null; rules: ReturnRules | null } | null;
}

export interface TermEndContext {
  now: Date;
  /** Rules in force now; an open return request brings its own. */
  currentRules: ReturnRules;
  /** When the return rules went live; overstay is never charged before it. */
  goLiveAt: Date;
}

export const TERM_END_TYPES = [
  NotificationType.CONTRACT_TERM_ENDING,
  NotificationType.CONTRACT_OVERDUE,
] as const;

/**
 * The reminder a contract is due today, in Vietnam days, or null.
 * - Overdue from the term end day on, unless a return is booked for today or later (a booking in
 *   the past that nobody turned up for still gets reminded).
 * - Ending from `noticeDays` before the last day until the term end, only with no return booked.
 * A contract already overdue is never told it is ending.
 */
export function planTermEndReminder(
  candidate: TermEndCandidate,
  ctx: TermEndContext,
): NotificationPayload | null {
  const { openReturn } = candidate;
  const rules = openReturn?.rules ?? ctx.currentRules;
  const today = vietnamToday(ctx.now);
  // Only the term and overstay figures are read, the same ones a settlement would charge.
  const timing = returnTiming({
    effectiveAt: candidate.effectiveAt,
    months: candidate.months,
    monthlyPrice: candidate.monthlyPrice,
    noticeFrom: ctx.now,
    scheduledAt: ctx.now,
    rules,
    goLiveAt: ctx.goLiveAt,
  });

  const overdue = today >= timing.termEndDay;
  if (overdue) {
    const scheduledDay = openReturn?.scheduledAt ? vietnamDate(openReturn.scheduledAt) : null;
    if (openReturn && !(scheduledDay && scheduledDay < today)) return null;
  } else if (openReturn || today < addVietnamDays(timing.lastDay, -rules.noticeDays)) {
    return null;
  }

  const facts = {
    unitCode: candidate.unitCode,
    contractNo: candidate.contractNo,
    lastDay: formatVietnamDate(timing.lastDay),
    penaltyFromDay: formatVietnamDate(addVietnamDays(timing.overstayFromDay, 1)),
    penaltyPerDay: formatVndCurrency(timing.overstayPenaltyPerDay),
  };
  const data = {
    contractId: candidate.contractId,
    termEndAt: timing.termEndAt.toISOString(),
    penaltyPerDay: timing.overstayPenaltyPerDay,
  };
  return overdue ? overduePayload(facts, data) : endingPayload(facts, rules.noticeDays, data);
}

interface Facts {
  unitCode: string;
  contractNo: string;
  lastDay: string;
  penaltyFromDay: string;
  penaltyPerDay: string;
}

function endingPayload(
  f: Facts,
  noticeDays: number,
  data: Record<string, unknown>,
): NotificationPayload {
  return {
    type: NotificationType.CONTRACT_TERM_ENDING,
    title: `Hợp đồng ${f.unitCode} sắp hết hạn`,
    body:
      `HĐ ${f.contractNo} hết hạn ngày ${f.lastDay}. Từ ngày ${f.penaltyFromDay} phí quá hạn ` +
      `${f.penaltyPerDay}/ngày sẽ trừ vào tiền cọc. Trả kho trước hạn cần đặt lịch trước ít nhất ` +
      `${noticeDays} ngày để không bị trừ 1 tháng tiền thuê.`,
    data,
  };
}

function overduePayload(f: Facts, data: Record<string, unknown>): NotificationPayload {
  return {
    type: NotificationType.CONTRACT_OVERDUE,
    title: `Hợp đồng ${f.unitCode} đã hết hạn`,
    body:
      `HĐ ${f.contractNo} đã hết hạn ngày ${f.lastDay}. Phí quá hạn ${f.penaltyPerDay}/ngày ` +
      `tính từ ngày ${f.penaltyFromDay} và trừ vào tiền cọc khi quyết toán. Hãy đặt lịch trả kho.`,
    data,
  };
}
