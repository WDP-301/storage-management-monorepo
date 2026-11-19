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
  /** Before the last day of the term: `earlyForfeitPercent` of the deposit is forfeited. */
  early: boolean;
  earlyForfeitPercent: number;
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
 * Early-return and overstay consequences of a return, in Vietnam calendar days, counted to the
 * effective return day. Returning on the last day of the term or on the day after it (the term
 * end) is on time: overstay is charged from the term end + 1. Early means before the last day,
 * which forfeits the captured share of the deposit however long the notice. Overstay never reaches back before go-live.
 */
export function returnTiming(input: ReturnTimingInput): ReturnTiming {
  const termEndAt = addVietnamMonths(input.effectiveAt, input.months);
  const termEndDay = vietnamDate(termEndAt);
  const lastDay = addVietnamDays(termEndDay, -1);
  const scheduledDay = vietnamDate(input.scheduledAt);
  const returnDay = effectiveReturnDay(scheduledDay, input.returnedOn);
  const early = returnDay < lastDay;

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
    early,
    // Requests captured before the share was configurable forfeited the whole deposit.
    earlyForfeitPercent: input.rules.earlyForfeitPercent ?? 100,
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
    early: timing.early,
    early_forfeit_percent: timing.earlyForfeitPercent,
    overstay_from_day: timing.overstayFromDay,
    overstay_days: timing.overstayDays,
    overstay_penalty_per_day: timing.overstayPenaltyPerDay,
    overstay_penalty: timing.overstayPenalty,
  };
}
