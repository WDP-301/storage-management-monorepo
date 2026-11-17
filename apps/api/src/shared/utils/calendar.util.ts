/**
 * Vietnam calendar helpers. Contract terms, notice periods and return days are counted in
 * Vietnam calendar days whatever the server time zone is. Vietnam has no daylight saving, so a
 * Vietnam day is a fixed +07:00 offset from UTC. Days are exchanged as `YYYY-MM-DD` strings.
 */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** UTC midnight of a `YYYY-MM-DD` day; throws on malformed or impossible days (2027-02-30). */
function utcMidnight(day: string): number {
  const match = DAY_PATTERN.exec(day);
  if (!match) throw new RangeError(`Invalid calendar day: ${day}`);
  const [year, month, date] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const ms = Date.UTC(year, month, date);
  const parsed = new Date(ms);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month ||
    parsed.getUTCDate() !== date
  ) {
    throw new RangeError(`Invalid calendar day: ${day}`);
  }
  return ms;
}

/** 00:00 Vietnam time on the day `at` falls on. */
export function startOfVietnamDay(at: Date): Date {
  return new Date(Math.floor((at.getTime() + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS);
}

/** The Vietnam calendar day (`YYYY-MM-DD`) `at` falls on. */
export function vietnamDate(at: Date): string {
  return new Date(at.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today in Vietnam. */
export function vietnamToday(now: Date = new Date()): string {
  return vietnamDate(now);
}

/** 00:00 Vietnam time of a `YYYY-MM-DD` day. */
export function fromVietnamDate(day: string): Date {
  return new Date(utcMidnight(day) - VN_OFFSET_MS);
}

/** Days since 1970-01-01 of a Vietnam day; subtract two of them to count days between. */
export function vietnamDayIndex(day: string | Date): number {
  const ms = typeof day === 'string' ? utcMidnight(day) : utcMidnight(vietnamDate(day));
  return Math.round(ms / DAY_MS);
}

/** The Vietnam day `days` after (or before, when negative) `day`. */
export function addVietnamDays(day: string, days: number): string {
  if (!Number.isInteger(days)) throw new RangeError(`days must be an integer: ${days}`);
  return new Date(utcMidnight(day) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * 00:00 Vietnam time of the day `months` calendar months after the Vietnam day `at` falls on.
 * A day missing from the target month clamps to its last day (31/01 + 1 month = 28/02 or 29/02).
 */
export function addVietnamMonths(at: Date, months: number): Date {
  if (!Number.isInteger(months)) throw new RangeError(`months must be an integer: ${months}`);
  const shifted = new Date(at.getTime() + VN_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + months;
  // Day 0 of the following month is the last day of the target month (Date.UTC normalises).
  const lastDate = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const date = Math.min(shifted.getUTCDate(), lastDate);
  return new Date(Date.UTC(year, month, date) - VN_OFFSET_MS);
}

/**
 * Like `addVietnamMonths`, while keeping the time-of-day of `at` in Vietnam time
 * (used for billing periods and first-month handover end instants).
 */
export function addVietnamCalendarMonths(at: Date, months: number): Date {
  if (!Number.isInteger(months)) throw new RangeError(`months must be an integer: ${months}`);
  const shifted = new Date(at.getTime() + VN_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + months;
  const lastDate = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const date = Math.min(shifted.getUTCDate(), lastDate);
  const ms = Date.UTC(
    year,
    month,
    date,
    shifted.getUTCHours(),
    shifted.getUTCMinutes(),
    shifted.getUTCSeconds(),
    shifted.getUTCMilliseconds(),
  );
  return new Date(ms - VN_OFFSET_MS);
}

const BARE_DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

/**
 * Parses a timestamp from SePay or user input. Explicit offsets (`Z`, `+07:00`, ...) are
 * respected; bare timestamps without a timezone offset (such as SePay's `"YYYY-MM-DD HH:mm:ss"`)
 * are interpreted in Vietnam time (`+07:00`) rather than server local time. Returns `null` for
 * empty or malformed strings.
 */
export function parseVietnamDateTime(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (DAY_PATTERN.test(trimmed)) {
    try {
      return fromVietnamDate(trimmed);
    } catch {
      return null;
    }
  }

  const match = BARE_DATETIME_PATTERN.exec(trimmed);
  if (!match) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const date = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? 0);
  const ms = Number((match[7] ?? '').padEnd(3, '0'));
  const utc = Date.UTC(year, month, date, hour, minute, second, ms);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month ||
    check.getUTCDate() !== date ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute ||
    check.getUTCSeconds() !== second
  ) {
    return null;
  }
  return new Date(utc - VN_OFFSET_MS);
}

/** `dd/MM/yyyy` of a Vietnam day, as customers read dates. */
export function formatVietnamDate(day: string | Date): string {
  const iso = typeof day === 'string' ? day : vietnamDate(day);
  utcMidnight(iso);
  const [year, month, date] = iso.split('-');
  return `${date}/${month}/${year}`;
}

/**
 * Checks if a time slot on a given Vietnam date has already passed.
 * Evaluates against the slot's starting time (e.g. "08:30 - 09:30" checks against 08:30).
 */
export function isPastVietnamTimeSlot(
  day: string,
  timeSlot?: string | null,
  now: Date = new Date(),
): boolean {
  const today = vietnamToday(now);
  if (day < today) return true;
  if (day > today || !timeSlot) return false;

  const match = /(\d{1,2}):(\d{2})/.exec(timeSlot);
  if (!match) return false;

  const slotHour = Number(match[1]);
  const slotMinute = Number(match[2]);

  const vnNow = new Date(now.getTime() + VN_OFFSET_MS);
  const nowHour = vnNow.getUTCHours();
  const nowMinute = vnNow.getUTCMinutes();

  if (nowHour > slotHour || (nowHour === slotHour && nowMinute >= slotMinute)) {
    return true;
  }
  return false;
}
