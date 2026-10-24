import type { Inspection } from '@entities/inspection.entity';
import { assertReturnDayInRange, changesAppointmentDay, moveReturn } from './contract-return.util';

// 01:00 on 22/10/2026 in Vietnam, still 21/10 in UTC.
const NOW = new Date('2026-10-21T18:00:00.000Z');

describe('assertReturnDayInRange', () => {
  it.each([
    ['the first moment of today in Vietnam', '2026-10-21T17:00:00.000Z'],
    ['the last moment of the 365th day ahead in Vietnam', '2027-10-22T16:59:59.999Z'],
  ])('accepts %s', (_label, at) => {
    expect(() => assertReturnDayInRange('scheduledAt', new Date(at), NOW)).not.toThrow();
  });

  it.each([
    ['the last moment of yesterday in Vietnam', '2026-10-21T16:59:59.999Z'],
    ['the first moment of the 366th day ahead in Vietnam', '2027-10-22T17:00:00.000Z'],
  ])('rejects %s with a field error on the day', (_label, at) => {
    expect(() => assertReturnDayInRange('scheduledAt', new Date(at), NOW)).toThrow(
      expect.objectContaining({
        status: 400,
        response: expect.objectContaining({
          details: {
            fields: [expect.objectContaining({ field: 'scheduledAt', code: 'outOfRange' })],
          },
        }),
      }),
    );
  });
});

describe('moveReturn', () => {
  const ANCHOR = new Date('2026-01-01T00:00:00.000Z');
  const RULES = { noticeDays: 15, penaltyPercent: 50 };
  const build = (scheduledAt: string) =>
    ({ scheduledAt: new Date(scheduledAt), noticeFrom: ANCHOR, returnRules: RULES }) as Inspection;

  it.each([
    ['earlier', '2027-03-10T05:00:00.000Z'],
    ['later', '2027-03-20T05:00:00.000Z'],
  ])('moves the day %s without touching the notice anchor or the rules', (_label, at) => {
    const inspection = build('2027-03-15T05:00:00.000Z');

    moveReturn(inspection, new Date(at), NOW);

    expect(inspection.scheduledAt).toEqual(new Date(at));
    expect(inspection.noticeFrom).toBe(ANCHOR);
    expect(inspection.returnRules).toBe(RULES);
  });

  it('accepts another time of the current day even once that day is past', () => {
    // 15/03/2026 in Vietnam is long before NOW (22/10/2026).
    const inspection = build('2026-03-15T05:00:00.000Z');

    moveReturn(inspection, new Date('2026-03-15T10:00:00.000Z'), NOW);

    expect(inspection.scheduledAt).toEqual(new Date('2026-03-15T10:00:00.000Z'));
  });

  it('rejects moving to a past Vietnam day', () => {
    const inspection = build('2027-03-15T05:00:00.000Z');

    expect(() => moveReturn(inspection, new Date('2026-10-21T16:59:59.999Z'), NOW)).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });
});

describe('changesAppointmentDay', () => {
  it('compares Vietnam days, not UTC dates', () => {
    // Both are 15/03 in Vietnam: 17:00 the same day, and 00:30 that day (14/03 in UTC).
    const inspection = { scheduledAt: new Date('2027-03-15T10:00:00.000Z') } as Inspection;

    expect(changesAppointmentDay(inspection, new Date('2027-03-14T17:30:00.000Z'))).toBe(false);
    // 23:00 on 14/03 in Vietnam: the same UTC day, a different Vietnam day.
    expect(changesAppointmentDay(inspection, new Date('2027-03-14T16:00:00.000Z'))).toBe(true);
  });

  it('counts a first appointment as a change', () => {
    expect(changesAppointmentDay({ scheduledAt: null } as unknown as Inspection, NOW)).toBe(true);
  });
});
