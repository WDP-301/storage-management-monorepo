import { isEmptyShift, shiftsOverlap } from './shift-time';

const shift = (startTime: string, endTime: string) => ({ startTime, endTime });

describe('shiftsOverlap', () => {
  it.each([
    ['back-to-back day shifts', shift('06:00', '12:00'), shift('12:00', '18:00'), false],
    ['partially overlapping day shifts', shift('06:00', '12:00'), shift('11:00', '14:00'), true],
    ['one shift inside another', shift('06:00', '18:00'), shift('09:00', '10:00'), true],
    ['overnight vs early morning', shift('22:00', '06:00'), shift('05:00', '07:00'), true],
    ['early morning vs overnight', shift('05:00', '07:00'), shift('22:00', '06:00'), true],
    ['overnight touching next shift', shift('22:00', '06:00'), shift('06:00', '12:00'), false],
    ['two overnight shifts', shift('20:00', '02:00'), shift('23:00', '04:00'), true],
    ['database HH:mm:ss format', shift('06:00:00', '12:00:00'), shift('11:30', '13:00'), true],
  ])('%s', (_label, a, b, expected) => {
    expect(shiftsOverlap(a, b)).toBe(expected);
  });
});

describe('isEmptyShift', () => {
  it('is true only when start and end are the same minute', () => {
    expect(isEmptyShift(shift('08:00', '08:00:00'))).toBe(true);
    expect(isEmptyShift(shift('08:00', '08:01'))).toBe(false);
  });
});
