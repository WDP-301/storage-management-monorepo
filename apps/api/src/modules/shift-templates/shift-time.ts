/** The time-of-day window of a shift (HH:mm or HH:mm:ss). */
export interface ShiftWindow {
  startTime: string;
  endTime: string;
}

const MINUTES_PER_DAY = 24 * 60;

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** [start, end) in minutes from midnight; an overnight shift ends past MINUTES_PER_DAY. */
function toSpan({ startTime, endTime }: ShiftWindow): [number, number] {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  return [start, end > start ? end : end + MINUTES_PER_DAY];
}

export function isEmptyShift({ startTime, endTime }: ShiftWindow): boolean {
  return toMinutes(startTime) === toMinutes(endTime);
}

/**
 * Whether two daily shifts share any minute. Shifts repeat every day, so one is also compared
 * shifted a day back and forward — that is how 22:00–06:00 collides with 05:00–07:00.
 * Touching ends (12:00–18:00 after 06:00–12:00) do not overlap.
 */
export function shiftsOverlap(a: ShiftWindow, b: ShiftWindow): boolean {
  const [aStart, aEnd] = toSpan(a);
  const [bStart, bEnd] = toSpan(b);
  return [-MINUTES_PER_DAY, 0, MINUTES_PER_DAY].some(
    (offset) => aStart < bEnd + offset && bStart + offset < aEnd,
  );
}
