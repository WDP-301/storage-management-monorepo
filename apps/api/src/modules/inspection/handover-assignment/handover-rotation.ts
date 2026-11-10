import type { StaffShift } from '@entities/staff-shift.entity';

/**
 * Round robin: the first staff member after `lastAssignedId` in `ordered`, wrapping around, who
 * is eligible. Starts at the head when nobody was assigned before or that person has left.
 */
export function nextInRotation(
  ordered: readonly { id: string }[],
  lastAssignedId: string | null,
  eligible: ReadonlySet<string>,
): string | null {
  const start = ordered.findIndex((member) => member.id === lastAssignedId) + 1;
  for (let step = 0; step < ordered.length; step += 1) {
    const candidate = ordered[(start + step) % ordered.length];
    if (eligible.has(candidate.id)) return candidate.id;
  }
  return null;
}

/** Staff with a shift running at every one of `times` (start inclusive, end exclusive). */
export function staffOnShiftAt(
  shifts: readonly Pick<StaffShift, 'staffId' | 'startAt' | 'endAt'>[],
  times: readonly Date[],
): Set<string> {
  const covering = (time: Date) =>
    new Set(
      shifts
        .filter((shift) => shift.startAt <= time && time < shift.endAt)
        .map((shift) => shift.staffId),
    );
  const [first, ...rest] = times.map(covering);
  if (!first) return new Set();
  return new Set([...first].filter((staffId) => rest.every((set) => set.has(staffId))));
}
