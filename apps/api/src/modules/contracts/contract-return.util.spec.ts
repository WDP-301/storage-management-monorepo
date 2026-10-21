import type { Inspection } from '@entities/inspection.entity';
import { assertReturnDayInRange, rescheduleReturn } from './contract-return.util';

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

describe('rescheduleReturn', () => {
  const RULES = { noticeDays: 30, penaltyPercent: 100 };
  const ANCHOR = new Date('2026-01-01T00:00:00.000Z');
  const build = (scheduledAt: string, overrides: Partial<Inspection> = {}) =>
    ({
      scheduledAt: new Date(scheduledAt),
      noticeFrom: ANCHOR,
      returnRules: { noticeDays: 15, penaltyPercent: 50 },
      ...overrides,
    }) as Inspection;
  let loadRules: jest.Mock;

  beforeEach(() => {
    loadRules = jest.fn().mockResolvedValue(RULES);
  });

  it('restarts the notice when the Vietnam day moves earlier, even by one hour', async () => {
    // 00:00 on 15/03 in Vietnam moves to 23:00 on 14/03: a different Vietnam day, the same UTC day.
    const inspection = build('2027-03-14T17:00:00.000Z');

    await rescheduleReturn(inspection, new Date('2027-03-14T16:00:00.000Z'), NOW, loadRules);

    expect(inspection.noticeFrom).toBe(NOW);
    expect(inspection.scheduledAt).toEqual(new Date('2027-03-14T16:00:00.000Z'));
  });

  it('keeps the notice when only the UTC date moves earlier, not the Vietnam day', async () => {
    // Both are 15/03 in Vietnam: 17:00 the same day, and 00:30 that day (14/03 in UTC).
    const inspection = build('2027-03-15T10:00:00.000Z');

    await rescheduleReturn(inspection, new Date('2027-03-14T17:30:00.000Z'), NOW, loadRules);

    expect(inspection.noticeFrom).toBe(ANCHOR);
    expect(inspection.scheduledAt).toEqual(new Date('2027-03-14T17:30:00.000Z'));
  });

  it('keeps the notice when the day moves later', async () => {
    const inspection = build('2027-03-15T05:00:00.000Z');

    await rescheduleReturn(inspection, new Date('2027-03-16T05:00:00.000Z'), NOW, loadRules);

    expect(inspection.noticeFrom).toBe(ANCHOR);
    expect(loadRules).not.toHaveBeenCalled();
  });

  it('keeps the rules the request captured when it moves earlier', async () => {
    const inspection = build('2027-03-15T05:00:00.000Z');

    await rescheduleReturn(inspection, new Date('2027-03-10T05:00:00.000Z'), NOW, loadRules);

    expect(inspection.returnRules).toEqual({ noticeDays: 15, penaltyPercent: 50 });
    expect(loadRules).not.toHaveBeenCalled();
  });

  it('captures the rules in force now when an older request without them moves earlier', async () => {
    const inspection = build('2027-03-15T05:00:00.000Z', { returnRules: null });

    await rescheduleReturn(inspection, new Date('2027-03-10T05:00:00.000Z'), NOW, loadRules);

    expect(inspection.returnRules).toEqual(RULES);
    expect(loadRules).toHaveBeenCalledTimes(1);
  });

  it('leaves the rules of an older request alone when it moves later', async () => {
    const inspection = build('2027-03-15T05:00:00.000Z', { returnRules: null });

    await rescheduleReturn(inspection, new Date('2027-03-20T05:00:00.000Z'), NOW, loadRules);

    expect(inspection.returnRules).toBeNull();
    expect(loadRules).not.toHaveBeenCalled();
  });
});
