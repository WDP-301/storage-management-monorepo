import type { ShiftTemplate } from '@entities/shift-template.entity';
import { type PlanInput, planShifts } from './auto-schedule.planner';
import { shiftPeriod } from './shift-calendar';

const template = (id: string, startTime: string, endTime: string) =>
  ({ id, code: id.toUpperCase(), name: id, startTime, endTime }) as ShiftTemplate;

const MORNING = template('morning', '06:00:00', '12:00:00');
const AFTERNOON = template('afternoon', '12:00:00', '18:00:00');
const LONG_DAY = template('long', '08:00:00', '16:00:00');

const staff = [
  { id: 'an', fullName: 'An' },
  { id: 'binh', fullName: 'Bình' },
  { id: 'chi', fullName: 'Chi' },
];

const input = (overrides: Partial<PlanInput> = {}): PlanInput => ({
  facilityId: 'hcm',
  dates: ['2026-11-10', '2026-11-11'],
  requirements: [{ template: MORNING, staffPerShift: 1 }],
  staff,
  existing: [],
  now: new Date('2026-11-01T00:00:00Z'),
  ...overrides,
});

const existingShift = (staffId: string, tpl: ShiftTemplate, workDate: string) => ({
  staffId,
  facilityId: 'hcm',
  shiftTemplateId: tpl.id,
  workDate,
  ...shiftPeriod(workDate, tpl),
});

const assignments = (result: ReturnType<typeof planShifts>) =>
  result.planned.map((shift) => `${shift.workDate} ${shift.template.id} ${shift.staff.id}`);

describe('planShifts', () => {
  it('spreads shifts evenly, ties going to the earlier candidate', () => {
    const result = planShifts(
      input({
        requirements: [
          { template: MORNING, staffPerShift: 1 },
          { template: AFTERNOON, staffPerShift: 1 },
        ],
      }),
    );

    expect(assignments(result)).toEqual([
      '2026-11-10 morning an',
      '2026-11-10 afternoon binh',
      '2026-11-11 morning chi',
      '2026-11-11 afternoon an',
    ]);
    expect(result.unfilled).toEqual([]);
  });

  it('lets one person take several back-to-back shifts a day', () => {
    const result = planShifts(
      input({
        dates: ['2026-11-10'],
        staff: [staff[0]],
        requirements: [
          { template: AFTERNOON, staffPerShift: 1 },
          { template: MORNING, staffPerShift: 1 },
        ],
      }),
    );

    expect(assignments(result)).toEqual(['2026-11-10 morning an', '2026-11-10 afternoon an']);
  });

  it('never gives one person overlapping shifts and reports the gap', () => {
    const result = planShifts(
      input({
        dates: ['2026-11-10'],
        staff: [staff[0]],
        requirements: [
          { template: MORNING, staffPerShift: 1 },
          { template: LONG_DAY, staffPerShift: 1 },
        ],
      }),
    );

    expect(assignments(result)).toEqual(['2026-11-10 morning an']);
    expect(result.unfilled).toEqual([{ workDate: '2026-11-10', template: LONG_DAY, missing: 1 }]);
  });

  it('counts staff already on a shift toward its headcount and their load', () => {
    const result = planShifts(
      input({
        requirements: [{ template: MORNING, staffPerShift: 2 }],
        existing: [existingShift('an', MORNING, '2026-11-10')],
      }),
    );

    expect(assignments(result)).toEqual([
      '2026-11-10 morning binh',
      '2026-11-11 morning chi',
      '2026-11-11 morning an',
    ]);
  });

  it('skips shifts that have already started', () => {
    const result = planShifts(input({ now: new Date('2026-11-10T00:00:00Z') }));

    expect(assignments(result)).toEqual(['2026-11-11 morning an']);
  });

  it('reports every place when there is no staff', () => {
    const result = planShifts(input({ staff: [], dates: ['2026-11-10'] }));

    expect(result.planned).toEqual([]);
    expect(result.unfilled).toEqual([{ workDate: '2026-11-10', template: MORNING, missing: 1 }]);
  });
});
