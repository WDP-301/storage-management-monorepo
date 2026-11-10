import { nextInRotation, staffOnShiftAt } from './handover-rotation';

const STAFF = [{ id: 'an' }, { id: 'binh' }, { id: 'chi' }];
const ALL = new Set(['an', 'binh', 'chi']);

const at = (iso: string) => new Date(iso);
const shift = (staffId: string, startAt: string, endAt: string) => ({
  staffId,
  startAt: at(startAt),
  endAt: at(endAt),
});

describe('nextInRotation', () => {
  it('starts at the head when nobody was assigned before', () => {
    expect(nextInRotation(STAFF, null, ALL)).toBe('an');
  });

  it('takes whoever comes after the last assigned person, wrapping around', () => {
    expect(nextInRotation(STAFF, 'an', ALL)).toBe('binh');
    expect(nextInRotation(STAFF, 'chi', ALL)).toBe('an');
  });

  it('passes over people who are not eligible', () => {
    expect(nextInRotation(STAFF, 'an', new Set(['an', 'chi']))).toBe('chi');
  });

  it('gives it back to the last person when only they are eligible', () => {
    expect(nextInRotation(STAFF, 'binh', new Set(['binh']))).toBe('binh');
  });

  it('starts at the head when the last assigned person has left', () => {
    expect(nextInRotation(STAFF, 'gone', ALL)).toBe('an');
  });

  it('returns null when nobody is eligible', () => {
    expect(nextInRotation(STAFF, 'an', new Set())).toBeNull();
  });
});

describe('staffOnShiftAt', () => {
  // 1 Nov, Vietnam time: morning 06–12, night 22–06.
  const MORNING_AN = shift('an', '2026-10-31T23:00:00Z', '2026-11-01T05:00:00Z');
  const NIGHT_BINH = shift('binh', '2026-11-01T15:00:00Z', '2026-11-01T23:00:00Z');

  it('keeps only staff whose shift runs at the handover time', () => {
    const tenAm = at('2026-11-01T03:00:00Z');

    expect(staffOnShiftAt([MORNING_AN, NIGHT_BINH], [tenAm])).toEqual(new Set(['an']));
  });

  it('counts the start of a shift but not its end', () => {
    expect(staffOnShiftAt([MORNING_AN], [at('2026-10-31T23:00:00Z')])).toEqual(new Set(['an']));
    expect(staffOnShiftAt([MORNING_AN], [at('2026-11-01T05:00:00Z')])).toEqual(new Set());
  });

  it('needs a shift at every handover time of the booking', () => {
    const tenAm = at('2026-11-01T03:00:00Z');
    const elevenPm = at('2026-11-01T16:00:00Z');
    const nightAn = shift('an', '2026-11-01T15:00:00Z', '2026-11-01T23:00:00Z');

    expect(staffOnShiftAt([MORNING_AN, NIGHT_BINH], [tenAm, elevenPm])).toEqual(new Set());
    expect(staffOnShiftAt([MORNING_AN, nightAn, NIGHT_BINH], [tenAm, elevenPm])).toEqual(
      new Set(['an']),
    );
  });
});
