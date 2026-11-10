jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_MINUTE: '* * * * *' },
}));

import { ContractStatus } from '@storage/types';
import { NoShowSuggestionService } from './no-show-suggestion.service';

// A contract whose start day is 10 days ago — over any no-show threshold <= 9 days.
const ROW = {
  contractId: 'c-1',
  contractNo: 'CT-1',
  customerId: 'cust-1',
  facilityId: 'fac-1',
  facilityName: 'Kho Quận 7',
  unitCode: 'A-01',
  effectiveAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
};

describe('NoShowSuggestionService', () => {
  let em: { query: jest.Mock; find: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let settings: { getNoShowAfterDays: jest.Mock };
  let notifications: { createForUsers: jest.Mock };
  let service: NoShowSuggestionService;

  const queueContractRows = (rows: unknown[], sentIds: string[] = []) => {
    em.query
      .mockResolvedValueOnce([{ acquired: true }]) // advisory lock
      .mockResolvedValueOnce(rows) // DRAFT candidate scan
      .mockResolvedValueOnce(sentIds.map((contractId) => ({ contractId }))); // already sent
  };

  beforeEach(() => {
    em = { query: jest.fn(), find: jest.fn() };
    dataSource = {
      transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(em)),
    };
    settings = { getNoShowAfterDays: jest.fn().mockResolvedValue(3) };
    notifications = { createForUsers: jest.fn().mockResolvedValue(1) };
    service = new NoShowSuggestionService(
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

  it('notifies the facility managers of a no-show contract once', async () => {
    queueContractRows([ROW]);
    expect(await service.run(new Date())).toBe(1);
    expect(notifications.createForUsers).toHaveBeenCalledWith(
      em,
      ['mgr-1'],
      expect.objectContaining({
        type: 'CONTRACT_NO_SHOW',
        data: expect.objectContaining({ contractId: 'c-1' }),
      }),
    );

    // The notification row is the dedupe record — a second run sends nothing.
    queueContractRows([ROW], ['c-1']);
    expect(await service.run(new Date())).toBe(0);
  });

  it('does not flag a contract still inside the threshold', async () => {
    // Started yesterday — inside a 3-day no-show threshold.
    const recent = { ...ROW, effectiveAt: new Date(Date.now() - 24 * 60 * 60 * 1000) };
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

  it('only scans DRAFT contracts', async () => {
    queueContractRows([]);
    await service.run(new Date());
    const [sql, params] = em.query.mock.calls[1];
    expect(sql).toContain('c.status = $1');
    expect(params).toEqual([ContractStatus.DRAFT]);
  });
});
