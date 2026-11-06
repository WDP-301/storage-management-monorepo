import type { ShiftWindow } from '@modules/shift-templates/shift-time';
import { fieldValidationError } from '@shared/exceptions/domain.exception';

/** Longest date range one request may cover. */
export const MAX_RANGE_DAYS = 31;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Shifts are wall-clock times in Vietnam, which has no daylight saving time. */
const VIETNAM_OFFSET = '+07:00';

const toUtcMidnight = (date: string): number => Date.parse(`${date}T00:00:00Z`);

/** Every YYYY-MM-DD date from `from` to `to`, both included. */
export function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let time = toUtcMidnight(from); time <= toUtcMidnight(to); time += DAY_MS) {
    dates.push(new Date(time).toISOString().slice(0, 10));
  }
  return dates;
}

export function addDays(date: string, days: number): string {
  return new Date(toUtcMidnight(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Refuses a reversed range or one longer than MAX_RANGE_DAYS. */
export function assertDateRange(from: string, to: string): void {
  const days = (toUtcMidnight(to) - toUtcMidnight(from)) / DAY_MS + 1;
  if (days < 1) throw fieldValidationError('to', 'RANGE_REVERSED', 'to must not be before from');
  if (days > MAX_RANGE_DAYS) {
    throw fieldValidationError(
      'to',
      'RANGE_TOO_LONG',
      `The range may span at most ${MAX_RANGE_DAYS} days`,
    );
  }
}

/** When a shift of `window` starting on `workDate` begins and ends; overnight ends the next day. */
export function shiftPeriod(workDate: string, window: ShiftWindow): { startAt: Date; endAt: Date } {
  const at = (time: string) => new Date(`${workDate}T${time.slice(0, 5)}:00${VIETNAM_OFFSET}`);
  const startAt = at(window.startTime);
  const sameDayEnd = at(window.endTime);
  const endAt = sameDayEnd > startAt ? sameDayEnd : new Date(sameDayEnd.getTime() + DAY_MS);
  return { startAt, endAt };
}

export function periodsOverlap(
  a: { startAt: Date; endAt: Date },
  b: { startAt: Date; endAt: Date },
): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}
