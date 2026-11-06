import { StaffShift } from '@entities/staff-shift.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { FacilitiesService } from '@modules/facilities/facilities.service';
import { Injectable } from '@nestjs/common';
import { StaffShiftStatus } from '@storage/types';
import { Between, type FindOptionsWhere, In, Not } from 'typeorm';
import { type PlannedShift, planShifts, type UnfilledSlot } from './auto-schedule.planner';
import type { AutoScheduleDto } from './dto/auto-schedule.dto';
import { addDays, assertDateRange, eachDate } from './shift-calendar';
import { StaffShiftsService } from './staff-shifts.service';
import type {
  AutoScheduleResponse,
  PlannedShiftRecord,
  UnfilledSlotRecord,
} from './types/staff-shift';

/** Builds a fair schedule for a facility and, unless it is a dry run, saves it. */
@Injectable()
export class AutoScheduleService {
  constructor(
    private readonly staffShifts: StaffShiftsService,
    private readonly facilities: FacilitiesService,
  ) {}

  run(dto: AutoScheduleDto, actor: AuthUser): Promise<AutoScheduleResponse> {
    assertDateRange(dto.from, dto.to);
    return this.staffShifts.withFacilityLock(dto.facilityId, async (em) => {
      // Also refuses a facility manager of another facility.
      const staff = await this.facilities.findStaff(dto.facilityId, actor);
      const requirements = [];
      for (const requirement of dto.requirements) {
        const template = await this.staffShifts.findActiveTemplate(em, requirement.shiftTemplateId);
        requirements.push({ template, staffPerShift: requirement.staffPerShift });
      }

      // From the day before, so an overnight shift running into the first day is seen.
      const live = { status: Not(StaffShiftStatus.CANCELLED) };
      const where: FindOptionsWhere<StaffShift>[] = [
        { ...live, facilityId: dto.facilityId, workDate: Between(dto.from, dto.to) },
      ];
      if (staff.length > 0) {
        where.push({
          ...live,
          staffId: In(staff.map((member) => member.id)),
          workDate: Between(addDays(dto.from, -1), dto.to),
        });
      }
      const existing = await em.find(StaffShift, { where });

      const { planned, unfilled } = planShifts({
        facilityId: dto.facilityId,
        dates: eachDate(dto.from, dto.to),
        requirements,
        staff,
        existing,
        now: new Date(),
      });

      if (!dto.dryRun && planned.length > 0) {
        await this.staffShifts.insertShifts(
          em,
          planned.map((shift) => ({
            staffId: shift.staff.id,
            facilityId: dto.facilityId,
            template: shift.template,
            workDate: shift.workDate,
          })),
          actor,
        );
      }
      return {
        dry_run: dto.dryRun,
        planned: planned.map(toPlannedShiftRecord),
        unfilled: unfilled.map(toUnfilledSlotRecord),
      };
    });
  }
}

function toPlannedShiftRecord(shift: PlannedShift): PlannedShiftRecord {
  return {
    staff_id: shift.staff.id,
    staff_name: shift.staff.fullName,
    shift_template_id: shift.template.id,
    shift_template_code: shift.template.code,
    shift_template_name: shift.template.name,
    work_date: shift.workDate,
    start_at: shift.startAt,
    end_at: shift.endAt,
  };
}

function toUnfilledSlotRecord(slot: UnfilledSlot): UnfilledSlotRecord {
  return {
    work_date: slot.workDate,
    shift_template_id: slot.template.id,
    shift_template_code: slot.template.code,
    missing: slot.missing,
  };
}
