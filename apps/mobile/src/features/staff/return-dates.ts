const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Calendar day in Vietnam (UTC+7, no daylight saving) — the clock the API records returns on. */
export function vietnamDayIso(date: Date): string {
  return new Date(date.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}
