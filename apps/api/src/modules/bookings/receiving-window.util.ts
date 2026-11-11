import type { ShiftWindow } from '@modules/shift-templates/shift-time';
import { shiftPeriod } from '@modules/staff-shifts/shift-calendar';
import { addVietnamDays, fromVietnamDate, vietnamDate } from '@shared/utils/calendar.util';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A receiving window on a Vietnam calendar day, as an absolute instant range. */
export interface ReceivingWindow {
  startAt: Date;
  endAt: Date;
}

export interface ReceivingFieldError {
  field: string;
  code: string;
  message: string;
}

/** Clips `periods` to `[clipStart, clipEnd)` and merges the intervals that touch or overlap. */
export function mergeWindows(
  periods: readonly ReceivingWindow[],
  clipStart: Date,
  clipEnd: Date,
): ReceivingWindow[] {
  const clipped = periods
    .map((period) => ({
      startAt: period.startAt < clipStart ? clipStart : period.startAt,
      endAt: period.endAt > clipEnd ? clipEnd : period.endAt,
    }))
    .filter((period) => period.startAt < period.endAt)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  const merged: ReceivingWindow[] = [];
  for (const window of clipped) {
    const last = merged[merged.length - 1];
    if (last && window.startAt <= last.endAt) {
      if (window.endAt > last.endAt) last.endAt = window.endAt;
    } else {
      merged.push({ ...window });
    }
  }
  return merged;
}

/**
 * The receiving windows of one Vietnam calendar day, from the system's work-shift templates.
 * A shift that started the previous Vietnam day (an overnight shift) still covers the early
 * hours of `date`, so both days' periods are laid over the day and merged.
 */
export function receivingWindowsForDate(
  date: string,
  templates: readonly ShiftWindow[],
): ReceivingWindow[] {
  const dayStart = fromVietnamDate(date);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);
  const periods = [
    ...templates.map((template) => shiftPeriod(addVietnamDays(date, -1), template)),
    ...templates.map((template) => shiftPeriod(date, template)),
  ];
  return mergeWindows(periods, dayStart, dayEnd);
}

/** Drops windows already over, and trims the one spanning `now` so it starts there. */
export function futureWindows(windows: readonly ReceivingWindow[], now: Date): ReceivingWindow[] {
  return windows
    .map((window) => ({
      startAt: window.startAt < now ? now : window.startAt,
      endAt: window.endAt,
    }))
    .filter((window) => window.startAt < window.endAt);
}

export function isWithinWindows(instant: Date, windows: readonly ReceivingWindow[]): boolean {
  return windows.some((window) => window.startAt <= instant && instant < window.endAt);
}

/**
 * Field errors for a booking's items whose `requestedStartAt` is in the past or outside every
 * system work shift. Pure so it can be unit-tested without the booking transaction.
 */
export function validateReceivingTimes(
  items: readonly { requestedStartAt: string }[],
  templates: readonly ShiftWindow[],
  now: Date = new Date(),
): ReceivingFieldError[] {
  const cache = new Map<string, ReceivingWindow[]>();
  const windowsFor = (date: string): ReceivingWindow[] => {
    const cached = cache.get(date);
    if (cached) return cached;
    const computed = receivingWindowsForDate(date, templates);
    cache.set(date, computed);
    return computed;
  };

  const errors: ReceivingFieldError[] = [];
  items.forEach((item, index) => {
    const startAt = new Date(item.requestedStartAt);
    if (!Number.isFinite(startAt.getTime())) return;
    const field = `items.${index}.requestedStartAt`;
    if (startAt < now) {
      errors.push({ field, code: 'pastTime', message: 'Giờ nhận kho phải ở tương lai' });
      return;
    }
    if (!isWithinWindows(startAt, windowsFor(vietnamDate(startAt)))) {
      errors.push({
        field,
        code: 'receivingTimeNotInShift',
        message: 'Giờ nhận kho phải nằm trong ca làm việc',
      });
    }
  });
  return errors;
}
