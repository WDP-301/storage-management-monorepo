jest.mock('@nestjs/schedule', () => ({ Cron: () => () => undefined }));

import { lastClosingTime, VisitAutoCloseService } from './visit-auto-close.service';

describe('lastClosingTime', () => {
  it('is today at the closing hour (Vietnam) once that hour has passed', () => {
    // 22:30 Vietnam = 15:30Z
    expect(lastClosingTime(new Date('2026-10-23T15:30:00Z'), 22)).toEqual(
      new Date('2026-10-23T15:00:00Z'),
    );
  });

  it('is yesterday before today’s closing hour', () => {
    // 21:59 Vietnam
    expect(lastClosingTime(new Date('2026-10-23T14:59:00Z'), 22)).toEqual(
      new Date('2026-10-22T15:00:00Z'),
    );
  });

  it('uses the Vietnam calendar day, not the UTC one', () => {
    // 01:00 Vietnam on the 24th is still the 23rd in UTC; closing at 0h → midnight of the 24th.
    expect(lastClosingTime(new Date('2026-10-23T18:00:00Z'), 0)).toEqual(
      new Date('2026-10-23T17:00:00Z'),
    );
  });
});

describe('VisitAutoCloseService.run', () => {
  let acquired: boolean;
  let closedIds: { id: string }[];
  let em: { query: jest.Mock };
  let notifications: { createForUsers: jest.Mock };
  let service: VisitAutoCloseService;

  beforeEach(() => {
    acquired = true;
    closedIds = [{ id: 'v-1' }];
    em = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('pg_try_advisory_xact_lock')) return [{ acquired }];
        if (sql.startsWith('UPDATE')) return [closedIds, closedIds.length];
        if (sql.includes('FROM "user_role_assignments"')) {
          return [{ userId: 'fm-1', facilityId: 'f-1' }];
        }
        return closedIds.map(({ id }) => ({
          id,
          facilityId: 'f-1',
          customerName: 'An',
          warehouseCode: 'W-1',
          usedAt: new Date('2026-10-23T10:00:00Z'),
        }));
      }),
    };
    notifications = { createForUsers: jest.fn(async () => 1) };
    service = new VisitAutoCloseService(
      { transaction: jest.fn((cb) => cb(em)) } as never,
      { getAccessClosingHour: jest.fn().mockResolvedValue(22) } as never,
      notifications as never,
    );
  });

  it('closes visits that began before the last closing time as AUTO and tells managers', async () => {
    const closed = await service.run(new Date('2026-10-23T15:10:00Z'));

    const update = em.query.mock.calls.find(([sql]) => sql.startsWith('UPDATE')) as [
      string,
      unknown[],
    ];
    expect(update[0]).toContain('"checked_out_at" IS NULL');
    expect(update[0]).toContain('e."used_at" < $1');
    expect(update[1]).toEqual([
      new Date('2026-10-23T15:00:00Z'),
      'AUTO',
      'Still inside at closing time',
    ]);
    expect(closed).toBe(1);
    expect(notifications.createForUsers).toHaveBeenCalledWith(
      em,
      ['fm-1'],
      expect.objectContaining({ type: 'CHECK_OUT_MISSED' }),
    );
  });

  it('does nothing while another instance holds the lock', async () => {
    acquired = false;
    await expect(service.run(new Date())).resolves.toBe(0);
    expect(em.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
  });

  it('sends nothing when no visit was open', async () => {
    closedIds = [];
    await service.run(new Date());
    expect(notifications.createForUsers).not.toHaveBeenCalled();
  });
});
