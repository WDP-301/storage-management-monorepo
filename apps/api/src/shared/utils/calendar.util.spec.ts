import {
  addVietnamDays,
  addVietnamMonths,
  formatVietnamDate,
  fromVietnamDate,
  startOfVietnamDay,
  vietnamDate,
  vietnamDayIndex,
  vietnamToday,
} from './calendar.util';

describe('calendar.util', () => {
  describe('vietnamDate', () => {
    it.each([
      ['2026-10-31T16:59:59.999Z', '2026-10-31'],
      ['2026-10-31T17:00:00.000Z', '2026-11-01'],
      ['2026-12-31T17:00:00.000Z', '2027-01-01'],
    ])('%s falls on %s in Vietnam', (at, expected) => {
      expect(vietnamDate(new Date(at))).toBe(expected);
    });
  });

  it('vietnamToday reads the Vietnam day of the given instant', () => {
    expect(vietnamToday(new Date('2027-02-28T17:30:00Z'))).toBe('2027-03-01');
  });

  it('vietnamToday defaults to the current instant, whatever the server time zone', () => {
    jest.useFakeTimers({ now: new Date('2026-10-31T17:00:00Z') });
    try {
      expect(vietnamToday()).toBe('2026-11-01');
    } finally {
      jest.useRealTimers();
    }
  });

  it('startOfVietnamDay returns 00:00 Vietnam time', () => {
    expect(startOfVietnamDay(new Date('2026-10-31T20:00:00Z')).toISOString()).toBe(
      '2026-10-31T17:00:00.000Z',
    );
  });

  describe('fromVietnamDate', () => {
    it('returns 00:00 Vietnam time of the day', () => {
      expect(fromVietnamDate('2027-04-01').toISOString()).toBe('2027-03-31T17:00:00.000Z');
    });

    it.each(['2027-02-30', '2027-13-01', '01/04/2027', '2027-4-1', ''])('rejects %p', (day) => {
      expect(() => fromVietnamDate(day)).toThrow(RangeError);
    });
  });

  describe('vietnamDayIndex', () => {
    it('counts days between Vietnam days across a month end', () => {
      expect(vietnamDayIndex('2027-03-01') - vietnamDayIndex('2027-02-28')).toBe(1);
    });

    it('uses the Vietnam day of an instant, not the UTC day', () => {
      expect(vietnamDayIndex(new Date('2026-10-31T17:00:00Z'))).toBe(vietnamDayIndex('2026-11-01'));
    });
  });

  describe('addVietnamDays', () => {
    it.each([
      ['2027-04-01', -1, '2027-03-31'],
      ['2028-02-28', 1, '2028-02-29'],
      ['2026-12-31', 365, '2027-12-31'],
    ])('%s plus %d day(s) is %s', (day, days, expected) => {
      expect(addVietnamDays(day, days)).toBe(expected);
    });

    it('rejects a fractional day count', () => {
      expect(() => addVietnamDays('2027-01-01', 0.5)).toThrow(RangeError);
    });
  });

  describe('addVietnamMonths', () => {
    it('starts from the Vietnam day: 2027-02-28T17:00Z is 01/03, plus one month is 01/04', () => {
      const end = addVietnamMonths(new Date('2027-02-28T17:00:00Z'), 1);
      expect(end.toISOString()).toBe('2027-03-31T17:00:00.000Z');
      expect(vietnamDate(end)).toBe('2027-04-01');
    });

    it('crosses into December from 2026-10-31T17:00Z (01/11 in Vietnam)', () => {
      expect(vietnamDate(addVietnamMonths(new Date('2026-10-31T17:00:00Z'), 1))).toBe('2026-12-01');
    });

    it.each([
      ['2027-01-31T05:00:00Z', 1, '2027-02-28'],
      ['2028-01-31T05:00:00Z', 1, '2028-02-29'],
      ['2026-08-31T05:00:00Z', 6, '2027-02-28'],
      ['2026-10-15T05:00:00Z', 12, '2027-10-15'],
      ['2027-03-31T05:00:00Z', -1, '2027-02-28'],
    ])('%s plus %d month(s) lands on %s, clamped to the month end', (at, months, expected) => {
      expect(vietnamDate(addVietnamMonths(new Date(at), months))).toBe(expected);
    });

    it('always lands on 00:00 Vietnam time', () => {
      const end = addVietnamMonths(new Date('2026-10-01T12:00:00Z'), 6);
      expect(end.toISOString()).toBe('2027-03-31T17:00:00.000Z');
    });

    it('rejects a fractional month count', () => {
      expect(() => addVietnamMonths(new Date(), 1.5)).toThrow(RangeError);
    });
  });

  describe('formatVietnamDate', () => {
    it('formats a day string and an instant as dd/MM/yyyy', () => {
      expect(formatVietnamDate('2027-04-01')).toBe('01/04/2027');
      expect(formatVietnamDate(new Date('2026-10-31T17:00:00Z'))).toBe('01/11/2026');
    });

    it('rejects a malformed day', () => {
      expect(() => formatVietnamDate('2027-02-30')).toThrow(RangeError);
    });
  });
});
