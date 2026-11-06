import type { ShiftTemplate } from '@entities/shift-template.entity';
import type { StaffShift } from '@entities/staff-shift.entity';
import { periodsOverlap, shiftPeriod } from './shift-calendar';

export interface PlanStaff {
  id: string;
  fullName: string;
}

export interface PlanInput {
  facilityId: string;
  dates: string[];
  requirements: { template: ShiftTemplate; staffPerShift: number }[];
  /** Candidates in a stable order; ties go to whoever comes first. */
  staff: PlanStaff[];
  /** Live (not cancelled) shifts of the facility and of the candidates around the dates. */
  existing: Pick<
    StaffShift,
    'staffId' | 'facilityId' | 'shiftTemplateId' | 'workDate' | 'startAt' | 'endAt'
  >[];
  now: Date;
}

export interface PlannedShift {
  staff: PlanStaff;
  template: ShiftTemplate;
  workDate: string;
  startAt: Date;
  endAt: Date;
}

export interface UnfilledSlot {
  workDate: string;
  template: ShiftTemplate;
  missing: number;
}

type Period = { startAt: Date; endAt: Date };

/**
 * Fills each day's shifts, in the order of the day, up to the required headcount. Staff already
 * on a shift count toward it. Each open place goes to the free candidate with the fewest shifts in
 * the range so far, so work spreads evenly; a staff member may take several shifts a day as long
 * as they do not overlap. Shifts that have already started are left alone. Places nobody can take
 * are reported as unfilled instead of failing the whole plan.
 */
export function planShifts(input: PlanInput): {
  planned: PlannedShift[];
  unfilled: UnfilledSlot[];
} {
  const inRange = new Set(input.dates);
  const busy = new Map<string, Period[]>(input.staff.map((member) => [member.id, []]));
  const load = new Map<string, number>(input.staff.map((member) => [member.id, 0]));
  for (const shift of input.existing) {
    busy.get(shift.staffId)?.push(shift);
    if (inRange.has(shift.workDate) && load.has(shift.staffId)) {
      load.set(shift.staffId, (load.get(shift.staffId) ?? 0) + 1);
    }
  }

  const requirements = [...input.requirements].sort((a, b) =>
    a.template.startTime.localeCompare(b.template.startTime),
  );
  const planned: PlannedShift[] = [];
  const unfilled: UnfilledSlot[] = [];

  for (const workDate of input.dates) {
    for (const { template, staffPerShift } of requirements) {
      const period = shiftPeriod(workDate, template);
      if (period.startAt <= input.now) continue;

      const alreadyOn = input.existing.filter(
        (shift) =>
          shift.facilityId === input.facilityId &&
          shift.workDate === workDate &&
          shift.shiftTemplateId === template.id,
      ).length;
      let missing = staffPerShift - alreadyOn;

      const candidates = input.staff
        .filter((member) => !busy.get(member.id)?.some((other) => periodsOverlap(period, other)))
        .sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0));
      for (const member of candidates) {
        if (missing <= 0) break;
        planned.push({ staff: member, template, workDate, ...period });
        busy.get(member.id)?.push(period);
        load.set(member.id, (load.get(member.id) ?? 0) + 1);
        missing -= 1;
      }
      if (missing > 0) unfilled.push({ workDate, template, missing });
    }
  }
  return { planned, unfilled };
}
