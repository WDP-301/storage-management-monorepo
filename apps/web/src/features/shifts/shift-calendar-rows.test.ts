import { describe, expect, it } from 'vitest';
import type { ShiftTemplateRecord, StaffShiftRecord } from '../../lib/staff-shifts-api';
import { shiftCalendarRows } from './shift-calendar-rows';

const office: ShiftTemplateRecord = {
  id: 'tpl-office',
  code: 'OFFICE',
  name: 'Ca hành chính',
  start_time: '08:00',
  end_time: '17:00',
  is_active: true,
};

const shift = (id: string, templateId: string, code: string, name: string) =>
  ({
    id,
    shift_template_id: templateId,
    shift_template_code: code,
    shift_template_name: name,
    // 06:00–12:00 Vietnam time.
    start_at: '2026-11-15T23:00:00.000Z',
    end_at: '2026-11-16T05:00:00.000Z',
  }) as StaffShiftRecord;

describe('shiftCalendarRows', () => {
  it('lists the active templates as they are', () => {
    expect(
      shiftCalendarRows([office], [shift('s-1', 'tpl-office', 'OFFICE', 'Ca hành chính')]),
    ).toEqual([{ ...office, retired: false }]);
  });

  it('keeps a retired template visible, once, while shifts in view still use it', () => {
    const rows = shiftCalendarRows(
      [office],
      [
        shift('s-1', 'tpl-morning', 'MORNING', 'Ca sáng'),
        shift('s-2', 'tpl-morning', 'MORNING', 'Ca sáng'),
      ],
    );

    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      id: 'tpl-morning',
      name: 'Ca sáng',
      start_time: '06:00',
      end_time: '12:00',
      retired: true,
    });
  });
});
