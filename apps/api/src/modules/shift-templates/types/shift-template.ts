import type { ShiftTemplate } from '@entities/shift-template.entity';

/** The `shift_templates` row exposed with its raw column names; times as HH:mm. */
export interface ShiftTemplateRecord {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface ShiftTemplateResponse {
  shift_template: ShiftTemplateRecord;
}

export interface ShiftTemplateListResponse {
  shift_templates: ShiftTemplateRecord[];
}

/** Postgres returns `time` as HH:mm:ss; seconds are never set, so they are dropped. */
const toHourMinute = (time: string): string => time.slice(0, 5);

export function toShiftTemplateRecord(row: ShiftTemplate): ShiftTemplateRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    start_time: toHourMinute(row.startTime),
    end_time: toHourMinute(row.endTime),
    is_active: row.isActive,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}
