/**
 * Choosing a receiving time inside the OFFICE work-shift window returned by
 * `GET /bookings/receiving-slots`.
 *
 * Kept free of runtime imports so `receiving-time.test.cjs` can transpile and load it standalone.
 * Instants travel as ISO strings; labels are shown in Vietnam time (fixed +07:00, no DST).
 */

export type ReceivingWindow = { startAt: string; endAt: string };
export type ReceivingDay = { date: string; windows: ReceivingWindow[] };
export type TimeOption = { value: string; label: string };

const VN_OFFSET_MIN = 7 * 60;
const DAY_MIN = 24 * 60;

/** `HH:mm` of an instant in Vietnam time. */
export function formatVnTime(instant: string): string {
  const at = new Date(instant);
  const minutes = (at.getUTCHours() * 60 + at.getUTCMinutes() + VN_OFFSET_MIN) % DAY_MIN;
  const hour = String(Math.floor(minutes / 60)).padStart(2, '0');
  const minute = String(minutes % 60).padStart(2, '0');
  return `${hour}:${minute}`;
}

export function windowsForDate(days: readonly ReceivingDay[], date: string): ReceivingWindow[] {
  return days.find((day) => day.date === date)?.windows ?? [];
}

/** A window too short for a whole-hour slot still offers one, rounded up to this step. */
const SHORT_WINDOW_STEP_MS = 15 * 60_000;

/**
 * On-the-hour slots inside the day's windows, labelled in Vietnam time. The API already trims
 * windows so they start at `now`, so slots begin at the next whole hour. A window too short for
 * one offers its start rounded up to the quarter hour — a trimmed start is the fetch instant,
 * already past by the time the form is sent.
 */
export function timeOptionsForDate(
  days: readonly ReceivingDay[],
  date: string,
  stepMinutes = 60,
): TimeOption[] {
  const stepMs = stepMinutes * 60_000;
  const options: TimeOption[] = [];
  for (const window of windowsForDate(days, date)) {
    const start = new Date(window.startAt).getTime();
    const end = new Date(window.endAt).getTime();
    const aligned = Math.ceil(start / stepMs) * stepMs;
    const begin =
      aligned < end ? aligned : Math.ceil(start / SHORT_WINDOW_STEP_MS) * SHORT_WINDOW_STEP_MS;
    for (let at = begin; at < end; at += stepMs) {
      const value = new Date(at).toISOString();
      options.push({ value, label: formatVnTime(value) });
    }
  }
  return options;
}

/** The slot offered by default: the first of the day, or null when the day has none. */
export function defaultInstant(
  days: readonly ReceivingDay[],
  date: string,
  stepMinutes = 60,
): string | null {
  return timeOptionsForDate(days, date, stepMinutes)[0]?.value ?? null;
}

/**
 * The slot to pre-pick on `date`. With a `preferred` instant (the current appointment), the slot
 * at its time of day, or none when that time is not offered — another hour is never chosen for
 * the customer. Without one, the first slot. Null when the day has no slots.
 */
export function preferredInstant(
  days: readonly ReceivingDay[],
  date: string,
  preferred: string | null,
  stepMinutes = 60,
): string | null {
  const options = timeOptionsForDate(days, date, stepMinutes);
  if (!preferred) return options[0]?.value ?? null;
  const wanted = formatVnTime(preferred);
  return options.find((option) => option.label === wanted)?.value ?? null;
}

/** Whether `instant` still falls inside one of the day's windows. */
export function isWithinWindows(
  days: readonly ReceivingDay[],
  date: string,
  instant: string,
): boolean {
  const at = new Date(instant).getTime();
  return windowsForDate(days, date).some(
    (window) => new Date(window.startAt).getTime() <= at && at < new Date(window.endAt).getTime(),
  );
}
