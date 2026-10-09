/**
 * Date maths for the rental schedule.
 *
 * Dates travel as ISO day strings (`2026-09-29`) rather than `Date` objects: they compare and
 * serialise as plain strings, and carry no time-of-day to drift across timezones. Formatting for
 * display happens at the edge, in `format-vi`.
 */

/**
 * Rental terms run in multiples of six months.
 *
 * The API does not enforce this yet — `bookings.rental_months` is only constrained to be positive
 * — so these values are the whole of the rule for now.
 */
export const DURATION_OPTIONS: readonly number[] = [6, 12, 18];

export const DEFAULT_DURATION_MONTHS = 6;

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parses an ISO day string as a local date, avoiding the UTC shift `new Date(iso)` would apply. */
export function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

/** One calendar month ahead, within the API's current 30-day booking lead limit. */
export function latestStartIso(today: string = todayIso()): string {
  const date = fromIsoDate(today);
  const lastDayOfNextMonth = new Date(date.getFullYear(), date.getMonth() + 2, 0).getDate();
  const calendarMonthLimit = toIsoDate(
    new Date(date.getFullYear(), date.getMonth() + 1, Math.min(date.getDate(), lastDayOfNextMonth)),
  );
  const apiLimit = toIsoDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 30));
  return calendarMonthLimit < apiLimit ? calendarMonthLimit : apiLimit;
}

/**
 * Last day of the rental: start + N months, minus one day.
 *
 * Clamps to the end of the target month so 31/01 + 1 month lands on 28/02 rather than rolling into
 * March, which is what `Date.setMonth` would do on its own.
 */
export function rentalEndIso(startIso: string, durationMonths: number): string {
  const start = fromIsoDate(startIso);
  const targetMonth = start.getMonth() + durationMonths;
  const lastDayOfTargetMonth = new Date(start.getFullYear(), targetMonth + 1, 0).getDate();
  const end = new Date(
    start.getFullYear(),
    targetMonth,
    Math.min(start.getDate(), lastDayOfTargetMonth),
  );

  end.setDate(end.getDate() - 1);
  return toIsoDate(end);
}
