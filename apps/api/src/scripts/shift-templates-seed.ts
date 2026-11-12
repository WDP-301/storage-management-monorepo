import { ShiftTemplateType } from '@storage/types';
import type { EntityManager } from 'typeorm';

/** The two production shifts: administrative hours and the around-the-clock storage duty. */
export const SHIFT_TEMPLATES_SEED = [
  {
    code: 'OFFICE',
    name: 'Ca hành chính',
    type: ShiftTemplateType.OFFICE,
    startTime: '08:00',
    endTime: '17:00',
  },
  {
    code: 'WAREHOUSE',
    name: 'Ca trực kho',
    type: ShiftTemplateType.WAREHOUSE,
    startTime: '17:00',
    endTime: '08:00',
  },
] as const;

/**
 * Replaces every shift template with the two production shifts. `staff_shifts.shift_template_id`
 * is ON DELETE RESTRICT, so the schedules that point at the old rows are cleared first —
 * destructive by design. Returns how many shifts were inserted.
 */
export async function seedShiftTemplates(manager: EntityManager): Promise<number> {
  await manager.query('DELETE FROM "staff_shifts"');
  await manager.query('DELETE FROM "shift_templates"');
  for (const shift of SHIFT_TEMPLATES_SEED) {
    await manager.query(
      `INSERT INTO "shift_templates" ("code", "name", "type", "start_time", "end_time")
       VALUES ($1, $2, $3, $4, $5)`,
      [shift.code, shift.name, shift.type, shift.startTime, shift.endTime],
    );
  }
  return SHIFT_TEMPLATES_SEED.length;
}
