import type { StaffShiftStatus } from '@storage/types';

export interface StaffShiftRecord {
  id: string;
  staff_id: string;
  staff_name: string | null;
  facility_id: string;
  shift_template_id: string;
  shift_template_code: string | null;
  shift_template_name: string | null;
  work_date: string;
  start_at: string;
  end_at: string;
  status: StaffShiftStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  note: string | null;
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffShiftListResponse {
  staff_shifts: StaffShiftRecord[];
}

export interface StaffShiftResponse {
  staff_shift: StaffShiftRecord;
}
