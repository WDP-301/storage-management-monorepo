import {
  futureWindows,
  isWithinWindows,
  mergeWindows,
  receivingWindowsForDate,
  validateReceivingTimes,
} from './receiving-window.util';

const MORNING = { startTime: '06:00', endTime: '12:00' };
const AFTERNOON = { startTime: '12:00', endTime: '18:00' };
const NIGHT = { startTime: '22:00', endTime: '06:00' };

const iso = (value: string) => value;

describe('mergeWindows', () => {
  it('merges overlapping and touching intervals', () => {
    const clipStart = new Date('2027-03-09T00:00:00Z');
    const clipEnd = new Date('2027-03-11T00:00:00Z');
    const merged = mergeWindows(
      [
        { startAt: new Date('2027-03-10T01:00:00Z'), endAt: new Date('2027-03-10T03:00:00Z') },
        { startAt: new Date('2027-03-10T02:00:00Z'), endAt: new Date('2027-03-10T05:00:00Z') },
        { startAt: new Date('2027-03-10T05:00:00Z'), endAt: new Date('2027-03-10T06:00:00Z') },
      ],
      clipStart,
      clipEnd,
    );
    expect(merged).toEqual([
      { startAt: new Date('2027-03-10T01:00:00Z'), endAt: new Date('2027-03-10T06:00:00Z') },
    ]);
  });

  it('clips to the day bounds and drops empty intervals', () => {
    const merged = mergeWindows(
      [
        { startAt: new Date('2027-03-09T20:00:00Z'), endAt: new Date('2027-03-10T02:00:00Z') },
        { startAt: new Date('2027-03-11T01:00:00Z'), endAt: new Date('2027-03-11T03:00:00Z') },
      ],
      new Date('2027-03-10T00:00:00Z'),
      new Date('2027-03-11T00:00:00Z'),
    );
    expect(merged).toEqual([
      { startAt: new Date('2027-03-10T00:00:00Z'), endAt: new Date('2027-03-10T02:00:00Z') },
    ]);
  });
});

describe('receivingWindowsForDate', () => {
  it('maps work-shift templates onto Vietnam instants', () => {
    const windows = receivingWindowsForDate('2027-03-10', [MORNING]);
    expect(windows).toEqual([
      {
        startAt: new Date(iso('2027-03-09T23:00:00.000Z')),
        endAt: new Date(iso('2027-03-10T05:00:00.000Z')),
      },
    ]);
  });

  it('merges adjacent shifts into one continuous window', () => {
    const windows = receivingWindowsForDate('2027-03-10', [MORNING, AFTERNOON]);
    expect(windows).toEqual([
      {
        startAt: new Date('2027-03-09T23:00:00.000Z'),
        endAt: new Date('2027-03-10T11:00:00.000Z'),
      },
    ]);
  });

  it('covers a night shift across both ends of the day', () => {
    const windows = receivingWindowsForDate('2027-03-11', [NIGHT]);
    // 00:00–06:00 (from the night before) and 22:00–24:00 (the same evening) Vietnam time.
    expect(windows).toEqual([
      {
        startAt: new Date('2027-03-10T17:00:00.000Z'),
        endAt: new Date('2027-03-10T23:00:00.000Z'),
      },
      {
        startAt: new Date('2027-03-11T15:00:00.000Z'),
        endAt: new Date('2027-03-11T17:00:00.000Z'),
      },
    ]);
  });

  it('has no window when there are no active shifts', () => {
    expect(receivingWindowsForDate('2027-03-10', [])).toEqual([]);
  });
});

describe('futureWindows', () => {
  it('drops finished windows and trims the current one', () => {
    const now = new Date('2027-03-10T02:00:00Z');
    const windows = futureWindows(
      [
        { startAt: new Date('2027-03-10T00:00:00Z'), endAt: new Date('2027-03-10T01:00:00Z') },
        { startAt: new Date('2027-03-10T01:00:00Z'), endAt: new Date('2027-03-10T05:00:00Z') },
      ],
      now,
    );
    expect(windows).toEqual([{ startAt: now, endAt: new Date('2027-03-10T05:00:00Z') }]);
  });
});

describe('isWithinWindows', () => {
  const windows = [
    { startAt: new Date('2027-03-09T23:00:00Z'), endAt: new Date('2027-03-10T05:00:00Z') },
  ];

  it('is inclusive of the start and exclusive of the end', () => {
    expect(isWithinWindows(new Date('2027-03-09T23:00:00Z'), windows)).toBe(true);
    expect(isWithinWindows(new Date('2027-03-10T05:00:00Z'), windows)).toBe(false);
  });
});

describe('validateReceivingTimes', () => {
  const now = new Date('2027-03-09T00:00:00Z');
  const templates = [MORNING, AFTERNOON];

  it('accepts a time inside a work shift', () => {
    expect(
      validateReceivingTimes([{ requestedStartAt: '2027-03-10T07:00:00+07:00' }], templates, now),
    ).toEqual([]);
  });

  it('rejects a time outside every work shift', () => {
    expect(
      validateReceivingTimes([{ requestedStartAt: '2027-03-10T20:00:00+07:00' }], templates, now),
    ).toEqual([
      {
        field: 'items.0.requestedStartAt',
        code: 'receivingTimeNotInShift',
        message: 'Giờ nhận kho phải nằm trong ca làm việc',
      },
    ]);
  });

  it('rejects a time in the past', () => {
    expect(
      validateReceivingTimes([{ requestedStartAt: '2027-03-01T08:00:00+07:00' }], templates, now),
    ).toEqual([
      {
        field: 'items.0.requestedStartAt',
        code: 'pastTime',
        message: 'Giờ nhận kho phải ở tương lai',
      },
    ]);
  });

  it('reports each offending item by index', () => {
    const errors = validateReceivingTimes(
      [
        { requestedStartAt: '2027-03-10T07:00:00+07:00' },
        { requestedStartAt: '2027-03-10T20:00:00+07:00' },
      ],
      templates,
      now,
    );
    expect(errors.map((error) => error.field)).toEqual(['items.1.requestedStartAt']);
  });
});
