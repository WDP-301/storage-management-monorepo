import {
  futureWindows,
  isWithinWindows,
  receivingWindowsForDate,
  validateReceivingTimes,
} from './receiving-window.util';

const OFFICE = [{ startTime: '08:00', endTime: '17:00' }];
const WAREHOUSE = [{ startTime: '17:00', endTime: '08:00' }];

describe('receivingWindowsForDate', () => {
  it('is the office shift of that Vietnam day', () => {
    const windows = receivingWindowsForDate('2027-03-10', OFFICE);

    expect(windows).toEqual([
      { startAt: new Date('2027-03-10T01:00:00Z'), endAt: new Date('2027-03-10T10:00:00Z') },
    ]);
  });

  it('lays an overnight shift over both ends of the day', () => {
    const windows = receivingWindowsForDate('2027-03-10', WAREHOUSE);

    expect(windows).toEqual([
      // 00:00–08:00 VN, the tail of the 09/03 night shift.
      { startAt: new Date('2027-03-09T17:00:00Z'), endAt: new Date('2027-03-10T01:00:00Z') },
      // 17:00–24:00 VN, the head of the 10/03 night shift.
      { startAt: new Date('2027-03-10T10:00:00Z'), endAt: new Date('2027-03-10T17:00:00Z') },
    ]);
  });
});

describe('isWithinWindows', () => {
  const windows = receivingWindowsForDate('2027-03-10', OFFICE);

  it('accepts an instant inside the window and rejects one outside', () => {
    expect(isWithinWindows(new Date('2027-03-10T02:00:00Z'), windows)).toBe(true);
    expect(isWithinWindows(new Date('2027-03-10T13:00:00Z'), windows)).toBe(false);
  });

  it('counts the start but not the end', () => {
    expect(isWithinWindows(new Date('2027-03-10T01:00:00Z'), windows)).toBe(true);
    expect(isWithinWindows(new Date('2027-03-10T10:00:00Z'), windows)).toBe(false);
  });
});

describe('futureWindows', () => {
  it('drops finished windows and trims the one spanning now', () => {
    const windows = receivingWindowsForDate('2027-03-10', OFFICE);
    const now = new Date('2027-03-10T03:00:00Z');

    expect(futureWindows(windows, now)).toEqual([
      { startAt: now, endAt: new Date('2027-03-10T10:00:00Z') },
    ]);
  });

  it('returns nothing when the day is over', () => {
    const windows = receivingWindowsForDate('2027-03-10', OFFICE);

    expect(futureWindows(windows, new Date('2027-03-11T00:00:00Z'))).toEqual([]);
  });
});

describe('validateReceivingTimes', () => {
  const now = new Date('2027-03-01T00:00:00Z');

  it('accepts an instant inside the office window', () => {
    expect(
      validateReceivingTimes([{ requestedStartAt: '2027-03-10T09:00:00+07:00' }], OFFICE, now),
    ).toEqual([]);
  });

  it('rejects an instant outside the office window', () => {
    expect(
      validateReceivingTimes([{ requestedStartAt: '2027-03-10T20:00:00+07:00' }], OFFICE, now),
    ).toEqual([
      {
        field: 'items.0.requestedStartAt',
        code: 'receivingTimeNotInShift',
        message: 'Giờ nhận kho phải nằm trong ca hành chính (OFFICE)',
      },
    ]);
  });

  it('rejects an instant in the past', () => {
    const errors = validateReceivingTimes(
      [{ requestedStartAt: '2027-02-01T09:00:00+07:00' }],
      OFFICE,
      now,
    );

    expect(errors.map((error) => error.code)).toEqual(['pastTime']);
  });

  it('reports the offending item index', () => {
    const errors = validateReceivingTimes(
      [
        { requestedStartAt: '2027-03-10T09:00:00+07:00' },
        { requestedStartAt: '2027-03-10T20:00:00+07:00' },
      ],
      OFFICE,
      now,
    );

    expect(errors.map((error) => error.field)).toEqual(['items.1.requestedStartAt']);
  });
});
