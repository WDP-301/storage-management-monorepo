// Business days are Vietnam calendar days (`YYYY-MM-DD`), whatever the viewer's timezone.

const VN_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Vietnam calendar day of an instant. */
export function vnDay(at: string | number | Date): string {
  return VN_DAY.format(new Date(at));
}

export const vnToday = (now: Date = new Date()): string => vnDay(now);

/** `day` shifted by whole days; plain calendar arithmetic, no timezone involved. */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

/** dd/mm/yyyy of a `YYYY-MM-DD` day; '—' when absent. */
export function formatVnDay(day: string | null | undefined): string {
  const match = day ? DAY_PATTERN.exec(day) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
}

/** Noon in Vietnam on `day`, as ISO: an instant that stays on that day in any timezone check. */
export function vnNoonIso(day: string): string {
  return new Date(`${day}T12:00:00+07:00`).toISOString();
}

/** Last day of a term whose exclusive end is `termEndAt` (00:00 Vietnam of the next day). */
export function lastDayBefore(termEndAt: string | Date): string {
  return vnDay(new Date(termEndAt).getTime() - 1);
}
