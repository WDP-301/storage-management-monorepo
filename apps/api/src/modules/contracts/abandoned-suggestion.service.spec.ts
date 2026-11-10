jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_MINUTE: '* * * * *' },
}));

import { ContractStatus } from '@storage/types';
import { AbandonedSuggestionService } from './abandoned-suggestion.service';

// A contract that started 14 months ago for 12 months ends ~2 months past — over any
// threshold <= 60 days; `months`/`effectiveAt` drive the day math, not the wall clock.
const ROW = {
  contractId: 'c-1',
  contractNo: 'CT-1',
  customerId: 'cust-1',
  facilityId: 'fac-1',
  facilityName: 'Kho Quận 7',
  unitCode: 'A-01',
  effectiveAt: new Date('2025-09-10T00:00:00Z'),
  months: 12,
};

describe('AbandonedSuggestionService', () => {
  let em: { query: jest.Mock; find: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let settings: { getAbandonedAfterDays: jest.Mock };
  let notifications: { createForUsers: jest.Mock };
  let service: AbandonedSuggestionService;

  const queueContractRows = (rows: unknown[], sentIds: string[] = []) => {
    em.query
      .mockResolvedValueOnce([{ acquired: true }]) // advisory lock
      .mockResolvedValueOnce(rows) // overdue candidate scan
      .mockResolvedValueOnce(sentIds.map((contractId) => ({ contractId }))); // already sent
  };

  beforeEach(() => {
    em = { query: jest.fn(), find: jest.fn() };
    dataSource = {
      transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(em)),
    };
    settings = { getAbandonedAfterDays: jest.fn().mockResolvedValue(30) };
    notifications = { createForUsers: jest.fn().mockResolvedValue(1) };
    service = new AbandonedSuggestionService(
      dataSource as never,
      settings as never,
      notifications as never,
    );
    em.find.mockResolvedValue([
      {
        userId: 'mgr-1',
        facilityId: 'fac-1',
        role: 'FACILITY_MANAGER',
        startsAt: new Date('2020-01-01T00:00:00Z'),
        endsAt: null,
      },
    ]);
  });

  it('skips the run when another instance holds the advisory lock', async () => {
    em.query.mockResolvedValueOnce([{ acquired: false }]);
    expect(await service.run(new Date())).toBe(0);
    expect(notifications.createForUsers).not.toHaveBeenCalled();
  });

  it('notifies the facility managers of an over-threshold contract once', async () => {
    queueContractRows([ROW]);
    expect(await service.run(new Date())).toBe(1);
    expect(notifications.createForUsers).toHaveBeenCalledWith(
      em,
      ['mgr-1'],
      expect.objectContaining({ data: expect.objectContaining({ contractId: 'c-1' }) }),
    );

    // The notification row is the dedupe record — a second run sends nothing.
    queueContractRows([ROW], ['c-1']);
    expect(await service.run(new Date())).toBe(0);
  });

  it('does not flag a contract still inside the threshold', async () => {
    // Effective last month for 12 months — term end is ~11 months out, not overdue.
    const recent = { ...ROW, effectiveAt: new Date('2026-10-20T00:00:00Z') };
    queueContractRows([recent]);
    expect(await service.run(new Date())).toBe(0);
    expect(notifications.createForUsers).not.toHaveBeenCalled();
  });

  it('sends nothing when the facility has no active manager', async () => {
    em.find.mockResolvedValue([]);
    queueContractRows([ROW]);
    expect(await service.run(new Date())).toBe(0);
    expect(notifications.createForUsers).not.toHaveBeenCalled();
  });

  it('only scans ACTIVE contracts without an open RETURN inspection', async () => {
    queueContractRows([]);
    await service.run(new Date());
    const [sql, params] = em.query.mock.calls[1];
    expect(sql).toContain('c.status = $1');
    expect(sql).toContain('i.type = $2');
    expect(params).toEqual([ContractStatus.ACTIVE, 'RETURN']);
  });
});
