jest.mock('@nestjs/schedule', () => ({ Cron: () => () => undefined }));

import { formatVndCurrency } from '@modules/invoices/invoice-pdf.service';
import { Logger } from '@nestjs/common';
import { NotificationType } from '@storage/types';
import { TermEndReminderService } from './term-end-reminder.service';

interface Stored {
  userId: string;
  type: string;
  contractId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

// 2026-01-10 12:00 in Vietnam, 12 months: the term ends on 2027-01-10 and the last day is 2027-01-09.
const EFFECTIVE_AT = new Date('2026-01-10T05:00:00.000Z');
const GO_LIVE = new Date('2026-06-01T00:00:00.000Z');
const at = (iso: string) => new Date(iso);

const row = (overrides: Record<string, unknown> = {}) => ({
  contractId: 'contract-1',
  contractNo: 'CT-1',
  customerId: 'customer-1',
  unitCode: 'A-01',
  effectiveAt: EFFECTIVE_AT,
  months: 12,
  monthlyPrice: '3000000.00',
  hasOpenReturn: false,
  returnScheduledAt: null,
  returnRules: null,
  ...overrides,
});

describe('TermEndReminderService.run', () => {
  let rows: Array<ReturnType<typeof row>>;
  let stored: Stored[];
  let lockAcquired: boolean;
  let noticeDays: number;
  let goLiveAt: Date;
  let em: { query: jest.Mock };
  let createForUsers: jest.Mock;
  let service: TermEndReminderService;

  beforeEach(() => {
    rows = [row()];
    stored = [];
    lockAcquired = true;
    noticeDays = 30;
    goLiveAt = GO_LIVE;
    em = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('pg_try_advisory_xact_lock')) return [{ acquired: lockAcquired }];
        if (sql.includes('FROM contracts')) return rows;
        if (sql.includes('FROM notifications')) return stored;
        throw new Error(`unexpected query: ${sql}`);
      }),
    };
    createForUsers = jest.fn(async (_em, userIds: string[], payload) => {
      for (const userId of userIds) {
        stored.push({ ...payload, userId, contractId: payload.data.contractId });
      }
      return userIds.length;
    });
    const settings = {
      getReturnNoticeDays: jest.fn(async () => noticeDays),
      getOverduePenaltyPercent: jest.fn().mockResolvedValue(100),
      getReturnRulesEffectiveAt: jest.fn(async () => goLiveAt),
    };
    service = new TermEndReminderService(
      { transaction: jest.fn((cb: (e: unknown) => unknown) => cb(em)) } as never,
      settings as never,
      { createForUsers } as never,
    );
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('sends nothing while the contract is more than the notice period from its last day', async () => {
    // Window opens 2026-12-10 (30 days before the last day, 2027-01-09).
    const result = await service.run(at('2026-12-09T01:00:00.000Z'));

    expect(result).toEqual({ ending: 0, overdue: 0 });
    expect(createForUsers).not.toHaveBeenCalled();
  });

  it('warns once when the notice window opens and not again on a rerun', async () => {
    const first = await service.run(at('2026-12-10T01:00:00.000Z'));
    const second = await service.run(at('2026-12-11T01:00:00.000Z'));

    expect(first).toEqual({ ending: 1, overdue: 0 });
    expect(second).toEqual({ ending: 0, overdue: 0 });
    expect(createForUsers).toHaveBeenCalledTimes(1);
    const [, recipients, payload] = createForUsers.mock.calls[0];
    expect(recipients).toEqual(['customer-1']);
    expect(payload).toMatchObject({
      type: NotificationType.CONTRACT_TERM_ENDING,
      title: 'Hợp đồng A-01 sắp hết hạn',
      data: {
        contractId: 'contract-1',
        termEndAt: '2027-01-09T17:00:00.000Z',
        penaltyPerDay: 100000,
      },
    });
    expect(payload.body).toContain('hết hạn ngày 09/01/2027');
    expect(payload.body).toContain(`Từ ngày 11/01/2027 phí quá hạn ${formatVndCurrency(100000)}`);
    expect(payload.body).toContain('ít nhất 30 ngày');
  });

  it('turns to an overdue notice once the term end day arrives, once', async () => {
    await service.run(at('2026-12-10T01:00:00.000Z'));
    const onTermEnd = await service.run(at('2027-01-10T01:00:00.000Z'));
    const rerun = await service.run(at('2027-01-11T01:00:00.000Z'));

    expect(onTermEnd).toEqual({ ending: 0, overdue: 1 });
    expect(rerun).toEqual({ ending: 0, overdue: 0 });
    expect(stored.map((n) => n.type)).toEqual([
      NotificationType.CONTRACT_TERM_ENDING,
      NotificationType.CONTRACT_OVERDUE,
    ]);
    expect(stored[1].title).toBe('Hợp đồng A-01 đã hết hạn');
  });

  it('sends only the overdue notice to a contract already past its term at the first run', async () => {
    const result = await service.run(at('2027-02-01T01:00:00.000Z'));

    expect(result).toEqual({ ending: 0, overdue: 1 });
    expect(stored.map((n) => n.type)).toEqual([NotificationType.CONTRACT_OVERDUE]);
  });

  it('stays quiet while a return is booked for a coming day', async () => {
    rows = [row({ hasOpenReturn: true, returnScheduledAt: at('2027-01-20T05:00:00.000Z') })];

    const inWindow = await service.run(at('2026-12-20T01:00:00.000Z'));
    const pastTerm = await service.run(at('2027-01-12T01:00:00.000Z'));

    expect(inWindow).toEqual({ ending: 0, overdue: 0 });
    expect(pastTerm).toEqual({ ending: 0, overdue: 0 });
    expect(createForUsers).not.toHaveBeenCalled();
  });

  it('still reminds an overdue customer whose booked return day has passed', async () => {
    rows = [row({ hasOpenReturn: true, returnScheduledAt: at('2027-01-05T05:00:00.000Z') })];

    const result = await service.run(at('2027-01-12T01:00:00.000Z'));

    expect(result).toEqual({ ending: 0, overdue: 1 });
  });

  it('sends nothing when another instance holds the lock', async () => {
    lockAcquired = false;

    const result = await service.run(at('2027-02-01T01:00:00.000Z'));

    expect(result).toEqual({ ending: 0, overdue: 0 });
    expect(createForUsers).not.toHaveBeenCalled();
    expect(em.query).toHaveBeenCalledTimes(1);
  });

  it('warns only on the last day when the notice period is zero', async () => {
    noticeDays = 0;

    const dayBefore = await service.run(at('2027-01-08T01:00:00.000Z'));
    const lastDay = await service.run(at('2027-01-09T01:00:00.000Z'));

    expect(dayBefore).toEqual({ ending: 0, overdue: 0 });
    expect(lastDay).toEqual({ ending: 1, overdue: 0 });
  });

  it('counts the day in Vietnam time at the 17:00 UTC boundary', async () => {
    // 16:59:59Z is still 2026-12-09 in Vietnam; one second later it is 2026-12-10.
    const before = await service.run(at('2026-12-09T16:59:59.000Z'));
    const after = await service.run(at('2026-12-09T17:00:00.000Z'));

    expect(before).toEqual({ ending: 0, overdue: 0 });
    expect(after).toEqual({ ending: 1, overdue: 0 });
  });

  it('starts charging the day after go-live when the rules went live after the term end', async () => {
    goLiveAt = at('2027-03-01T03:00:00.000Z');

    await service.run(at('2027-03-05T01:00:00.000Z'));

    expect(stored[0].body).toContain('tính từ ngày 02/03/2027');
  });

  it('prices the penalty with the percent captured on the open return request', async () => {
    rows = [
      row({
        hasOpenReturn: true,
        returnScheduledAt: at('2027-01-05T05:00:00.000Z'),
        returnRules: { noticeDays: 30, penaltyPercent: 200 },
      }),
    ];

    await service.run(at('2027-01-12T01:00:00.000Z'));

    expect(stored[0].data.penaltyPerDay).toBe(200000);
    expect(stored[0].body).toContain(formatVndCurrency(200000));
  });

  it('keeps reminders per contract so a second contract is not suppressed by the first', async () => {
    rows = [row(), row({ contractId: 'contract-2', contractNo: 'CT-2', unitCode: 'B-02' })];

    const result = await service.run(at('2027-02-01T01:00:00.000Z'));

    expect(result).toEqual({ ending: 0, overdue: 2 });
  });
});

describe('TermEndReminderService.handle', () => {
  it('logs and swallows a failed run', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const service = new TermEndReminderService(
      { transaction: jest.fn().mockRejectedValue(new Error('db down')) } as never,
      {} as never,
      {} as never,
    );

    await expect(service.handle()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('db down'), expect.anything());
    error.mockRestore();
  });
});
