import type { StaffShiftStatus } from '@storage/types';
import { apiClient } from './api';

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
}

export interface ShiftTemplateRecord {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface PlannedShiftRecord {
  staff_id: string;
  staff_name: string;
  shift_template_id: string;
  shift_template_code: string;
  shift_template_name: string;
  work_date: string;
  start_at: string;
  end_at: string;
}

export interface UnfilledSlotRecord {
  work_date: string;
  shift_template_id: string;
  shift_template_code: string;
  missing: number;
}

export interface AutoScheduleResult {
  dry_run: boolean;
  planned: PlannedShiftRecord[];
  unfilled: UnfilledSlotRecord[];
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

const unwrap = <T>(res: { data: ApiEnvelope<T> | T }): T =>
  res.data && typeof res.data === 'object' && 'data' in res.data ? res.data.data : res.data;

export const StaffShiftsApi = {
  /** Shifts of one facility inside an inclusive YYYY-MM-DD range (at most 31 days). */
  list: async (params: {
    facilityId: string;
    from: string;
    to: string;
    staffId?: string;
  }): Promise<StaffShiftRecord[]> => {
    const res = await apiClient.get<ApiEnvelope<{ staff_shifts: StaffShiftRecord[] }>>(
      '/staff-shifts',
      { params },
    );
    return unwrap(res).staff_shifts;
  },

  /** Active shift templates staff can be scheduled on. */
  templates: async (): Promise<ShiftTemplateRecord[]> => {
    const res =
      await apiClient.get<ApiEnvelope<{ shift_templates: ShiftTemplateRecord[] }>>(
        '/shift-templates',
      );
    return unwrap(res).shift_templates;
  },

  /** Schedule every staff on the template for every listed date, all or nothing. */
  create: async (input: {
    facilityId: string;
    shiftTemplateId: string;
    staffIds: string[];
    workDates: string[];
    note?: string;
  }): Promise<StaffShiftRecord[]> => {
    const res = await apiClient.post<ApiEnvelope<{ staff_shifts: StaffShiftRecord[] }>>(
      '/staff-shifts',
      input,
    );
    return unwrap(res).staff_shifts;
  },

  /** Fill each day's shifts up to the required headcount; dryRun only previews. */
  autoSchedule: async (input: {
    facilityId: string;
    from: string;
    to: string;
    requirements: { shiftTemplateId: string; headcount: number }[];
    dryRun: boolean;
  }): Promise<AutoScheduleResult> => {
    const res = await apiClient.post<ApiEnvelope<AutoScheduleResult>>(
      '/staff-shifts/auto-schedule',
      input,
    );
    return unwrap(res);
  },

  update: async (
    id: string,
    patch: { shiftTemplateId?: string; workDate?: string; note?: string | null },
  ): Promise<StaffShiftRecord> => {
    const res = await apiClient.patch<ApiEnvelope<{ staff_shift: StaffShiftRecord }>>(
      `/staff-shifts/${id}`,
      patch,
    );
    return unwrap(res).staff_shift;
  },

  cancel: async (id: string): Promise<void> => {
    await apiClient.patch(`/staff-shifts/${id}/cancel`);
  },
};
