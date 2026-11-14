import type { ShiftTemplateRecord, StaffShiftRecord } from '../../lib/staff-shifts-api';
import { vnTimeOfDay } from '../../lib/vn-day';

export interface ShiftCalendarRow extends ShiftTemplateRecord {
  /** No longer offered for new rosters; shown only because shifts in view still use it. */
  retired: boolean;
}

/**
 * Rows of the week calendar: the active templates, then any deactivated one that the shown shifts
 * still point at — a roster made before its template was retired must stay visible and editable.
 * A retired row's hours come from its shifts (the template itself is not listed by the API).
 */
export function shiftCalendarRows(
  templates: readonly ShiftTemplateRecord[],
  shifts: readonly StaffShiftRecord[],
): ShiftCalendarRow[] {
  const rows: ShiftCalendarRow[] = templates.map((template) => ({ ...template, retired: false }));
  const known = new Set(templates.map((template) => template.id));
  for (const shift of shifts) {
    if (known.has(shift.shift_template_id)) continue;
    known.add(shift.shift_template_id);
    rows.push({
      id: shift.shift_template_id,
      code: shift.shift_template_code ?? '',
      name: shift.shift_template_name ?? shift.shift_template_code ?? 'Ca cũ',
      start_time: vnTimeOfDay(shift.start_at),
      end_time: vnTimeOfDay(shift.end_at),
      is_active: false,
      retired: true,
    });
  }
  return rows;
}
