import { describe, expect, it } from 'vitest';
import { moveTimeOptions, pickMoveTime } from './move-slots-api';

// 08:00–12:00 and 13:00–17:00 Vietnam time on 20/11/2026.
const DAY = [
  { startAt: '2026-11-20T01:00:00.000Z', endAt: '2026-11-20T05:00:00.000Z' },
  { startAt: '2026-11-20T06:00:00.000Z', endAt: '2026-11-20T10:00:00.000Z' },
];

describe('moveTimeOptions', () => {
  it('offers on-the-hour slots inside each window, labelled in Vietnam time', () => {
    const labels = moveTimeOptions(DAY).map((o) => o.label);

    expect(labels).toEqual([
      '08:00',
      '09:00',
      '10:00',
      '11:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
    ]);
  });

  it('starts a window trimmed to now at the next whole hour', () => {
    const options = moveTimeOptions([
      { startAt: '2026-11-20T01:25:00.000Z', endAt: '2026-11-20T03:00:00.000Z' },
    ]);

    expect(options.map((o) => o.label)).toEqual(['09:00']);
  });

  it('still offers the start of a window too short for a whole hour', () => {
    const options = moveTimeOptions([
      { startAt: '2026-11-20T04:30:00.000Z', endAt: '2026-11-20T05:00:00.000Z' },
    ]);

    expect(options).toEqual([{ value: '2026-11-20T04:30:00.000Z', label: '11:30' }]);
  });

  it('rounds a last-hour window trimmed to now up to the quarter hour, never the fetch instant', () => {
    // Fetched at 16:05:12 with the shift ending at 17:00.
    const trimmed = moveTimeOptions([
      { startAt: '2026-11-20T09:05:12.345Z', endAt: '2026-11-20T10:00:00.000Z' },
    ]);
    expect(trimmed).toEqual([{ value: '2026-11-20T09:15:00.000Z', label: '16:15' }]);

    // Fetched at 16:50 — no quarter hour is left before the shift ends.
    const closing = moveTimeOptions([
      { startAt: '2026-11-20T09:50:00.000Z', endAt: '2026-11-20T10:00:00.000Z' },
    ]);
    expect(closing).toEqual([]);
  });
});

describe('pickMoveTime', () => {
  const options = moveTimeOptions(DAY);

  it("keeps the customer's time of day when the new day still offers it", () => {
    // 14:00 Vietnam on another day.
    expect(pickMoveTime(options, '2026-11-18T07:00:00.000Z')).toBe('2026-11-20T07:00:00.000Z');
  });

  it('falls back to the first slot, or null when the day has none', () => {
    expect(pickMoveTime(options, '2026-11-18T12:00:00.000Z')).toBe(options[0].value);
    expect(pickMoveTime(options, null)).toBe(options[0].value);
    expect(pickMoveTime([], '2026-11-18T07:00:00.000Z')).toBeNull();
  });
});
