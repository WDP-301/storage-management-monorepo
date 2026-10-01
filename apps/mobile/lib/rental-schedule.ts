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

/** How far ahead the customer may schedule a handover. */
export const SCHEDULABLE_DAYS = 30;

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export type RentalDateOption = {
  /** ISO day string, the value stored on the booking. */
  iso: string;
  /** Vietnamese weekday abbreviation, e.g. `T4`. */
  weekday: string;
  /** Zero-padded day of month, e.g. `30`. */
  day: string;
  /** Zero-padded month, e.g. `09`. */
  month: string;
  isToday: boolean;
};

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

/**
 * The selectable days, starting today. Because the strip starts at today, past dates are
 * unreachable by construction rather than by validation.
 */
export function buildDateOptions(days: number = SCHEDULABLE_DAYS): RentalDateOption[] {
  const today = new Date();
  const todayValue = toIsoDate(today);

  return Array.from({ length: days }, (_, offset) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const iso = toIsoDate(date);

    return {
      iso,
      weekday: WEEKDAY_LABELS[date.getDay()] ?? '',
      day: String(date.getDate()).padStart(2, '0'),
      month: String(date.getMonth() + 1).padStart(2, '0'),
      isToday: iso === todayValue,
    };
  });
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
