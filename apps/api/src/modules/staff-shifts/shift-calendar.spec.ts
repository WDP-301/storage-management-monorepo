import { DomainException } from '@shared/exceptions/domain.exception';
import { addDays, assertDateRange, eachDate, MAX_RANGE_DAYS, shiftPeriod } from './shift-calendar';

describe('shift-calendar', () => {
  it('lists every date of a range, across a month end', () => {
    expect(eachDate('2026-11-29', '2026-12-02')).toEqual([
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
    ]);
  });

  it('adds days across a month end', () => {
    expect(addDays('2026-12-01', -1)).toBe('2026-11-30');
  });

  it('accepts a range of exactly MAX_RANGE_DAYS and refuses longer or reversed ones', () => {
    expect(() =>
      assertDateRange('2026-11-01', addDays('2026-11-01', MAX_RANGE_DAYS - 1)),
    ).not.toThrow();
    expect(() => assertDateRange('2026-11-01', addDays('2026-11-01', MAX_RANGE_DAYS))).toThrow(
      DomainException,
    );
    expect(() => assertDateRange('2026-11-02', '2026-11-01')).toThrow(DomainException);
  });

  it('places a day shift in Vietnam time', () => {
    const { startAt, endAt } = shiftPeriod('2026-11-10', {
      startTime: '06:00',
      endTime: '12:00:00',
    });

    expect(startAt.toISOString()).toBe('2026-11-09T23:00:00.000Z');
    expect(endAt.toISOString()).toBe('2026-11-10T05:00:00.000Z');
  });

  it('ends an overnight shift on the next day', () => {
    const { startAt, endAt } = shiftPeriod('2026-11-10', { startTime: '22:00', endTime: '06:00' });

    expect(startAt.toISOString()).toBe('2026-11-10T15:00:00.000Z');
    expect(endAt.toISOString()).toBe('2026-11-10T23:00:00.000Z');
  });
});
