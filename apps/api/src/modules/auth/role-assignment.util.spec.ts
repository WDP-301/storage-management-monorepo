import { isAssignmentActive } from './role-assignment.util';

const NOW = new Date('2026-10-03T00:00:00Z').getTime();

describe('isAssignmentActive', () => {
  it('is active inside the window and inactive outside it', () => {
    const active = { startsAt: new Date('2026-10-01'), endsAt: new Date('2026-10-05') };
    const notYet = { startsAt: new Date('2026-10-04'), endsAt: null };
    const ended = { startsAt: new Date('2026-09-01'), endsAt: new Date('2026-10-03') };

    expect(isAssignmentActive(active, NOW)).toBe(true);
    expect(isAssignmentActive(notYet, NOW)).toBe(false);
    expect(isAssignmentActive(ended, NOW)).toBe(false); // endsAt is exclusive
  });

  it('treats a null endsAt as open-ended', () => {
    expect(isAssignmentActive({ startsAt: new Date('2026-01-01'), endsAt: null }, NOW)).toBe(true);
  });
});
