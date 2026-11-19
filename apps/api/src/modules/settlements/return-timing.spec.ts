import {
  effectiveReturnDay,
  type ReturnTimingInput,
  returnTiming,
  toReturnTimingRecord,
} from './return-timing';

/** Noon in Vietnam on a calendar day. */
const at = (day: string) => new Date(`${day}T05:00:00.000Z`);

/** 6-month term from 01/10/2026: last day 31/03/2027, term end 01/04/2027. */
const base = (overrides: Partial<ReturnTimingInput> = {}): ReturnTimingInput => ({
  effectiveAt: new Date('2026-10-01T12:00:00.000Z'),
  months: 6,
  monthlyPrice: '1500000.00',
  scheduledAt: at('2027-03-31'),
  rules: { noticeDays: 30, penaltyPercent: 100 },
  goLiveAt: new Date('2026-06-01T00:00:00.000Z'),
  ...overrides,
});

describe('returnTiming', () => {
  it('derives the term end and last day in Vietnam days', () => {
    const timing = returnTiming(base());

    expect(timing.termEndAt).toEqual(new Date('2027-03-31T17:00:00.000Z'));
    expect(timing.termEndDay).toBe('2027-04-01');
    expect(timing.lastDay).toBe('2027-03-31');
  });

  it.each([
    ['on the last day of the term', '2027-03-31'],
    ['on the term end day', '2027-04-01'],
  ])('treats a return %s as on time', (_label, day) => {
    const timing = returnTiming(base({ scheduledAt: at(day) }));

    expect(timing).toMatchObject({ early: false, overstayDays: 0, overstayPenalty: 0 });
  });

  it('treats any return before the last day as early, however long the notice', () => {
    expect(returnTiming(base({ scheduledAt: at('2027-02-15') })).early).toBe(true);
    expect(returnTiming(base({ scheduledAt: at('2026-10-02') })).early).toBe(true);
  });

  it('charges each day past the term end', () => {
    const timing = returnTiming(base({ scheduledAt: at('2027-04-11') }));

    expect(timing).toMatchObject({
      early: false,
      overstayFromDay: '2027-04-01',
      overstayDays: 10,
      overstayPenaltyPerDay: 50000,
      overstayPenalty: 500000,
    });
  });

  it('charges overstay only from go-live when the rules went live after the term end', () => {
    const timing = returnTiming(
      base({ scheduledAt: at('2027-04-11'), goLiveAt: new Date('2027-04-05T03:00:00.000Z') }),
    );

    expect(timing.overstayFromDay).toBe('2027-04-05');
    expect(timing.overstayDays).toBe(6);
    expect(timing.overstayPenalty).toBe(300000);
  });

  it('counts money to the actual return day when it is later than the appointment', () => {
    const timing = returnTiming(base({ scheduledAt: at('2027-03-20'), returnedOn: '2027-04-05' }));

    expect(timing).toMatchObject({
      scheduledDay: '2027-03-20',
      effectiveReturnDay: '2027-04-05',
      early: false,
      overstayDays: 4,
    });
  });

  it('counts to the finalize day, not to a later appointment', () => {
    const timing = returnTiming(base({ scheduledAt: at('2027-04-05'), returnedOn: '2027-02-10' }));

    expect(timing).toMatchObject({
      effectiveReturnDay: '2027-02-10',
      early: true,
      overstayDays: 0,
    });
  });

  it('counts to the finalize day, not to an earlier appointment', () => {
    const timing = returnTiming(base({ scheduledAt: at('2027-02-10'), returnedOn: '2027-03-31' }));

    expect(timing).toMatchObject({ effectiveReturnDay: '2027-03-31', early: false });
  });

  it.each([
    [1000000, 100, 33333],
    // 33 334.5 rounds half up, not to even.
    [1000035, 100, 33335],
    [1500000, 150, 75000],
    [1000000, 0, 0],
  ])('rounds the daily charge of %d at %d%% half up to %d', (price, percent, perDay) => {
    const timing = returnTiming(
      base({ monthlyPrice: price, rules: { noticeDays: 30, penaltyPercent: percent } }),
    );

    expect(timing.overstayPenaltyPerDay).toBe(perDay);
  });

  it('starts the term on the Vietnam day of effectiveAt', () => {
    // 00:00 on 01/03 in Vietnam is still 28/02 in UTC.
    const timing = returnTiming(
      base({
        effectiveAt: new Date('2027-02-28T17:00:00.000Z'),
        months: 1,
        scheduledAt: at('2027-03-31'),
      }),
    );

    expect(timing.termEndDay).toBe('2027-04-01');
    expect(timing.termEndAt).toEqual(new Date('2027-03-31T17:00:00.000Z'));
    expect(timing.lastDay).toBe('2027-03-31');
    expect(timing.early).toBe(false);
  });

  it.each([
    ['the day before the last day', '2027-03-30', true],
    ['the last day', '2027-03-31', false],
    ['the term end day', '2027-04-01', false],
  ])('is early only before the last day: %s', (_label, day, early) => {
    expect(returnTiming(base({ scheduledAt: at(day) })).early).toBe(early);
  });

  it.each([
    ['the term end day', '2027-04-01', 0, 0],
    ['the day after the term end', '2027-04-02', 1, 50000],
    ['two days after the term end', '2027-04-03', 2, 100000],
  ])('charges overstay from the day after the term end: %s', (_label, day, days, penalty) => {
    const timing = returnTiming(base({ scheduledAt: at(day) }));

    expect(timing.overstayFromDay).toBe('2027-04-01');
    expect(timing.overstayDays).toBe(days);
    expect(timing.overstayPenalty).toBe(penalty);
  });

  it.each([
    // 00:00 and 23:59:59.999 in Vietnam, both on a day whose UTC date is the day before.
    ['starts the last day', '2027-03-30T17:00:00.000Z', false, 0],
    ['is still the day before the last', '2027-03-30T16:59:59.999Z', true, 0],
    ['starts the term end day', '2027-03-31T17:00:00.000Z', false, 0],
    ['starts the day after the term end', '2027-04-01T17:00:00.000Z', false, 1],
  ])('reads the appointment in Vietnam time: %s', (_label, scheduledAt, early, overstay) => {
    const timing = returnTiming(base({ scheduledAt: new Date(scheduledAt) }));

    expect(timing.early).toBe(early);
    expect(timing.overstayDays).toBe(overstay);
  });

  it('reads the go-live moment in Vietnam time', () => {
    // 00:30 on 05/04 in Vietnam, still 04/04 in UTC: overstay counts from 05/04, so 6 days.
    const timing = returnTiming(
      base({ scheduledAt: at('2027-04-11'), goLiveAt: new Date('2027-04-04T17:30:00.000Z') }),
    );

    expect(timing.overstayFromDay).toBe('2027-04-05');
    expect(timing.overstayDays).toBe(6);
  });

  it('keeps overstay counted from the term end when the rules went live before it', () => {
    const timing = returnTiming(
      base({ scheduledAt: at('2027-04-11'), goLiveAt: new Date('2027-03-31T00:00:00.000Z') }),
    );

    expect(timing.overstayFromDay).toBe('2027-04-01');
    expect(timing.overstayDays).toBe(10);
  });

  it('maps to the snake_case record shared with clients', () => {
    const record = toReturnTimingRecord(returnTiming(base({ scheduledAt: at('2027-02-15') })));

    expect(record).toEqual({
      term_end_at: new Date('2027-03-31T17:00:00.000Z'),
      last_day: '2027-03-31',
      scheduled_day: '2027-02-15',
      effective_return_day: '2027-02-15',
      early: true,
      overstay_from_day: '2027-04-01',
      overstay_days: 0,
      overstay_penalty_per_day: 50000,
      overstay_penalty: 0,
    });
  });
});

describe('effectiveReturnDay', () => {
  it('is the finalize day once there is one, the appointment until then', () => {
    expect(effectiveReturnDay('2027-03-20')).toBe('2027-03-20');
    expect(effectiveReturnDay('2027-03-20', null)).toBe('2027-03-20');
    expect(effectiveReturnDay('2027-03-20', '2027-03-10')).toBe('2027-03-10');
    expect(effectiveReturnDay('2027-03-20', '2027-04-05')).toBe('2027-04-05');
  });
});
