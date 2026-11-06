import type { StaffShift } from '@entities/staff-shift.entity';
import type { StaffShiftStatus } from '@storage/types';

/** The `staff_shifts` row with its raw column names, plus the staff and shift names to show. */
export interface StaffShiftRecord {
  id: string;
  staff_id: string;
  staff_name: string | null;
  facility_id: string;
  shift_template_id: string;
  shift_template_code: string | null;
  shift_template_name: string | null;
  work_date: string;
  start_at: string | Date;
  end_at: string | Date;
  status: StaffShiftStatus;
  check_in_at: string | Date | null;
  check_out_at: string | Date | null;
  note: string | null;
  assigned_by: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface StaffShiftResponse {
  staff_shift: StaffShiftRecord;
}

export interface StaffShiftListResponse {
  staff_shifts: StaffShiftRecord[];
}

/** A shift the auto-scheduler assigns (or, on a dry run, would assign). */
export interface PlannedShiftRecord {
  staff_id: string;
  staff_name: string;
  shift_template_id: string;
  shift_template_code: string;
  shift_template_name: string;
  work_date: string;
  start_at: string | Date;
  end_at: string | Date;
}

/** A shift slot that still lacks `missing` staff after auto-scheduling. */
export interface UnfilledSlotRecord {
  work_date: string;
  shift_template_id: string;
  shift_template_code: string;
  missing: number;
}

export interface AutoScheduleResponse {
  dry_run: boolean;
  planned: PlannedShiftRecord[];
  unfilled: UnfilledSlotRecord[];
}

/** Expects `staff` and `shiftTemplate` loaded; names are null if either row is missing. */
export function toStaffShiftRecord(row: StaffShift): StaffShiftRecord {
  return {
    id: row.id,
    staff_id: row.staffId,
    staff_name: row.staff?.fullName ?? null,
    facility_id: row.facilityId,
    shift_template_id: row.shiftTemplateId,
    shift_template_code: row.shiftTemplate?.code ?? null,
    shift_template_name: row.shiftTemplate?.name ?? null,
    work_date: row.workDate,
    start_at: row.startAt,
    end_at: row.endAt,
    status: row.status,
    check_in_at: row.checkInAt,
    check_out_at: row.checkOutAt,
    note: row.note,
    assigned_by: row.assignedBy,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}
