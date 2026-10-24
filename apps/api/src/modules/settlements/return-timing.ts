import {
  addVietnamDays,
  addVietnamMonths,
  vietnamDate,
  vietnamDayIndex,
} from '@shared/utils/calendar.util';
import type { ReturnRules, ReturnTimingRecord } from '@storage/types';
import Decimal from 'decimal.js';

export interface ReturnTimingInput {
  /** Start of the contract term; the term is counted in Vietnam calendar months from its day. */
  effectiveAt: Date;
  months: number;
  /** Monthly rent as stored (numeric columns arrive as strings). */
  monthlyPrice: number | string;
  /** Since when the customer's notice runs. */
  noticeFrom: Date;
  /** The appointment; money only follows it while the return is not finalized (an estimate). */
  scheduledAt: Date;
  /** Vietnam day the return was finalized, once it is (`YYYY-MM-DD`). */
  returnedOn?: string | null;
  /** Rules captured on the return request. */
  rules: ReturnRules;
  /** When the return rules went live; nothing before it is charged. */
  goLiveAt: Date;
}

export interface ReturnTiming {
  /** 00:00 Vietnam time of the first day after the term (exclusive end). */
  termEndAt: Date;
  termEndDay: string;
  lastDay: string;
  scheduledDay: string;
  effectiveReturnDay: string;
  noticeFrom: Date;
  noticeDays: number;
  requiredNoticeDays: number;
  early: boolean;
  shortNotice: boolean;
  shortNoticeDeduction: number;
  overstayFromDay: string;
  overstayDays: number;
  overstayPenaltyPerDay: number;
  overstayPenalty: number;
}

const maxDay = (a: string, b: string): string => (a > b ? a : b);
const toDong = (value: Decimal.Value): Decimal =>
  new Decimal(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

/**
 * The day money is counted to: the day the return was finalized. The appointment is only a
 * schedule; it stands in for that day until the return is finalized, so a preview shows what
 * returning on the appointment would cost.
 */
export function effectiveReturnDay(scheduledDay: string, returnedOn?: string | null): string {
  return returnedOn ?? scheduledDay;
}

/**
 * Notice and overstay consequences of a return, in Vietnam calendar days, counted to the
 * effective return day. Returning on the last day of the term or on the day after it (the term
 * end) is on time: overstay is charged from the term end + 1. Early means before the last day; a
 * short notice costs one month of rent, but only when the notice started after the rules went
 * live. Overstay never reaches back before go-live.
 */
export function returnTiming(input: ReturnTimingInput): ReturnTiming {
  const termEndAt = addVietnamMonths(input.effectiveAt, input.months);
  const termEndDay = vietnamDate(termEndAt);
  const lastDay = addVietnamDays(termEndDay, -1);
  const scheduledDay = vietnamDate(input.scheduledAt);
  const returnDay = effectiveReturnDay(scheduledDay, input.returnedOn);
  const monthlyPrice = toDong(input.monthlyPrice);

  const noticeDays = vietnamDayIndex(returnDay) - vietnamDayIndex(input.noticeFrom);
  const early = returnDay < lastDay;
  const shortNotice =
    early &&
    noticeDays < input.rules.noticeDays &&
    input.noticeFrom.getTime() >= input.goLiveAt.getTime();

  const overstayFromDay = maxDay(termEndDay, vietnamDate(input.goLiveAt));
  const overstayDays = Math.max(0, vietnamDayIndex(returnDay) - vietnamDayIndex(overstayFromDay));
  // monthly / 30 × percent / 100 in a single division so no intermediate rounding creeps in.
  const penaltyPerDay = toDong(
    new Decimal(input.monthlyPrice).mul(input.rules.penaltyPercent).div(30 * 100),
  );

  return {
    termEndAt,
    termEndDay,
    lastDay,
    scheduledDay,
    effectiveReturnDay: returnDay,
    noticeFrom: input.noticeFrom,
    noticeDays,
    requiredNoticeDays: input.rules.noticeDays,
    early,
    shortNotice,
    shortNoticeDeduction: shortNotice ? monthlyPrice.toNumber() : 0,
    overstayFromDay,
    overstayDays,
    overstayPenaltyPerDay: penaltyPerDay.toNumber(),
    overstayPenalty: penaltyPerDay.mul(overstayDays).toNumber(),
  };
}

export function toReturnTimingRecord(timing: ReturnTiming): ReturnTimingRecord {
  return {
    term_end_at: timing.termEndAt,
    last_day: timing.lastDay,
    scheduled_day: timing.scheduledDay,
    effective_return_day: timing.effectiveReturnDay,
    notice_from: timing.noticeFrom,
    notice_days: timing.noticeDays,
    required_notice_days: timing.requiredNoticeDays,
    early: timing.early,
    short_notice: timing.shortNotice,
    short_notice_deduction: timing.shortNoticeDeduction,
    overstay_from_day: timing.overstayFromDay,
    overstay_days: timing.overstayDays,
    overstay_penalty_per_day: timing.overstayPenaltyPerDay,
    overstay_penalty: timing.overstayPenalty,
  };
}
