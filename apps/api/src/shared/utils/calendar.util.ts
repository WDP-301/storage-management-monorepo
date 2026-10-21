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

/** `dd/MM/yyyy` of a Vietnam day, as customers read dates. */
export function formatVietnamDate(day: string | Date): string {
  const iso = typeof day === 'string' ? day : vietnamDate(day);
  utcMidnight(iso);
  const [year, month, date] = iso.split('-');
  return `${date}/${month}/${year}`;
}
