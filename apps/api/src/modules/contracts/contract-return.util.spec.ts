import type { Inspection } from '@entities/inspection.entity';
import {
  assertReturnDayInRange,
  assertReturnTimeInOfficeShift,
  changesAppointment,
  moveReturn,
} from './contract-return.util';

// 01:00 on 22/10/2026 in Vietnam, still 21/10 in UTC.
const NOW = new Date('2026-10-21T18:00:00.000Z');
/** 08:00–17:00 Vietnam time. */
const OFFICE = [{ startTime: '08:00', endTime: '17:00' }];

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
    ['to another in-shift time of the same day', '2027-03-15T02:00:00.000Z'],
  ])('moves %s without touching the notice anchor or the rules', (_label, at) => {
    const inspection = build('2027-03-15T05:00:00.000Z');

    expect(moveReturn(inspection, new Date(at), OFFICE, NOW)).toBe(true);

    expect(inspection.scheduledAt).toEqual(new Date(at));
    expect(inspection.noticeFrom).toBe(ANCHOR);
    expect(inspection.returnRules).toBe(RULES);
  });

  it('accepts the current appointment sent back unchanged even once it is past', () => {
    // 15/03/2026 in Vietnam is long before NOW (22/10/2026).
    const inspection = build('2026-03-15T05:00:00.000Z');

    expect(moveReturn(inspection, new Date('2026-03-15T05:00:00.000Z'), OFFICE, NOW)).toBe(false);

    expect(inspection.scheduledAt).toEqual(new Date('2026-03-15T05:00:00.000Z'));
  });

  it('rejects moving to a past Vietnam day', () => {
    const inspection = build('2027-03-15T05:00:00.000Z');

    expect(() => moveReturn(inspection, new Date('2026-10-21T16:59:59.999Z'), OFFICE, NOW)).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });

  it('rejects moving to a time outside the OFFICE shift', () => {
    const inspection = build('2027-03-15T05:00:00.000Z');

    // 20:00 on 15/03 in Vietnam.
    expect(() => moveReturn(inspection, new Date('2027-03-15T13:00:00.000Z'), OFFICE, NOW)).toThrow(
      expect.objectContaining({ status: 400 }),
    );
    expect(inspection.scheduledAt).toEqual(new Date('2027-03-15T05:00:00.000Z'));
  });
});

describe('assertReturnTimeInOfficeShift', () => {
  it('accepts a future time inside the shift', () => {
    expect(() =>
      assertReturnTimeInOfficeShift(
        'scheduledAt',
        new Date('2026-10-22T02:00:00.000Z'),
        OFFICE,
        NOW,
      ),
    ).not.toThrow();
  });

  it.each([
    ['a past time', '2026-10-21T10:00:00.000Z', 'pastTime'],
    ['a time before the shift opens', '2026-10-22T00:30:00.000Z', 'returnTimeNotInShift'],
    ['the end of the shift (exclusive)', '2026-10-22T10:00:00.000Z', 'returnTimeNotInShift'],
  ])('rejects %s', (_label, at, code) => {
    expect(() => assertReturnTimeInOfficeShift('scheduledAt', new Date(at), OFFICE, NOW)).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          details: { fields: [expect.objectContaining({ field: 'scheduledAt', code })] },
        }),
      }),
    );
  });
});

describe('changesAppointment', () => {
  it('compares instants, so another time of the same day is a change', () => {
    const inspection = { scheduledAt: new Date('2027-03-15T10:00:00.000Z') } as Inspection;

    expect(changesAppointment(inspection, new Date('2027-03-15T10:00:00.000Z'))).toBe(false);
    expect(changesAppointment(inspection, new Date('2027-03-15T02:00:00.000Z'))).toBe(true);
  });

  it('counts a first appointment as a change', () => {
    expect(changesAppointment({ scheduledAt: null } as unknown as Inspection, NOW)).toBe(true);
  });
});
