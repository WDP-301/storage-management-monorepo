jest.mock('@nestjs/schedule', () => ({ Cron: () => () => undefined }));

import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Invoice } from '@entities/invoice.entity';
import { Payment } from '@entities/payment.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitChangeRequest } from '@entities/unit-change-request.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import {
  ChangeRequestStatus,
  ContractStatus,
  InvoiceStatus,
  NotificationType,
  StorageUnitStatus,
} from '@storage/types';
import { MoveDaySweepService } from './move-day-sweep.service';

const NOW = new Date('2026-06-15T10:00:00+07:00');
const YESTERDAY = new Date(NOW.getTime() - 86400_000);

const buildRequest = (overrides: Record<string, unknown> = {}): UnitChangeRequest =>
  ({
    id: 'req-1',
    contractId: 'contract-1',
    oldUnitId: 'unit-old',
    newUnitId: 'unit-new',
    requestedBy: 'customer-1',
    status: ChangeRequestStatus.APPROVED,
    moveAt: YESTERDAY,
    history: [],
    oldUnit: { id: 'unit-old', code: 'A-01', facilityId: 'fac-a' },
    newUnit: { id: 'unit-new', code: 'B-02', facilityId: 'fac-b' },
    ...overrides,
  }) as unknown as UnitChangeRequest;

const activeAssignment = (facilityId: string, userId: string): UserRoleAssignment =>
  ({
    role: 'FACILITY_MANAGER',
    facilityId,
    userId,
    startsAt: new Date(Date.now() - 60_000),
    endsAt: undefined,
  }) as unknown as UserRoleAssignment;

describe('MoveDaySweepService', () => {
  /** The row the locked re-read returns — mutated by handleOne like the DB row would be. */
  let row: UnitChangeRequest;
  let contractRow: unknown;
  let bookingItemRow: unknown;
  let invoiceRow: unknown;
  let succeededPayments: number;
  let assignments: UserRoleAssignment[];
  let em: {
    findOne: jest.Mock;
    find: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let runnerManagerFind: jest.Mock;
  let notifications: { createForUsers: jest.Mock };
  let service: MoveDaySweepService;
  let advisoryGranted: boolean;

  beforeEach(() => {
    row = buildRequest();
    contractRow = { id: 'contract-1', status: ContractStatus.ACTIVE, bookingItemId: 'bi-1' };
    bookingItemRow = { id: 'bi-1', storageUnitId: 'unit-old' };
    invoiceRow = { id: 'inv-1', status: InvoiceStatus.ISSUED, invoiceNo: 'INV-1' };
    succeededPayments = 0;
    assignments = [activeAssignment('fac-a', 'mgr-a'), activeAssignment('fac-b', 'mgr-b')];
    advisoryGranted = true;

    em = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === UnitChangeRequest) return row;
        if (entity === Contract) return contractRow;
        if (entity === BookingItem) return bookingItemRow;
        if (entity === Invoice) return invoiceRow;
        return null;
      }),
      find: jest.fn(async (entity: unknown, options?: { where?: { facilityId?: string } }) => {
        if (entity === UserRoleAssignment) {
          const facilityId = options?.where?.facilityId;
          return facilityId ? assignments.filter((a) => a.facilityId === facilityId) : assignments;
        }
        return [];
      }),
      count: jest.fn(async (entity: unknown) => (entity === Payment ? succeededPayments : 0)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      // Persists the row back — the way a real save would.
      save: jest.fn(async (v: unknown) => {
        if (v === row) return v;
        return v;
      }),
      createQueryBuilder: jest.fn(),
    };
    runnerManagerFind = jest.fn(async () => [row]);
    notifications = { createForUsers: jest.fn() };

    service = new MoveDaySweepService(
      {
        createQueryRunner: jest.fn(() => ({
          connect: jest.fn(),
          query: jest.fn(async (sql: string) =>
            sql.includes('pg_try_advisory_lock') ? [{ acquired: advisoryGranted }] : [],
          ),
          release: jest.fn(),
          manager: { find: runnerManagerFind },
        })),
        transaction: jest.fn(async (fn: (m: unknown) => unknown) => fn(em)),
      } as never,
      notifications as never,
    );
  });

  it('flips a due APPROVED request to TRANSITIONING and pings both facilities', async () => {
    const result = await service.run(NOW);

    expect(result).toEqual({ started: 1, reminded: 0, cancelled: 0 });
    expect(row.status).toBe(ChangeRequestStatus.TRANSITIONING);
    expect(row.transitionStartAt).toBe(NOW);
    const [, userIds, payload] = notifications.createForUsers.mock.calls[0];
    expect(new Set(userIds)).toEqual(new Set(['mgr-a', 'mgr-b']));
    expect(payload.type).toBe(NotificationType.UNIT_CHANGE_MOVE_TODAY);
  });

  it('leaves a future-dated APPROVED request alone', async () => {
    row = buildRequest({ moveAt: new Date(NOW.getTime() + 86400_000) });

    const result = await service.run(NOW);

    expect(result).toEqual({ started: 0, reminded: 0, cancelled: 0 });
    expect(row.status).toBe(ChangeRequestStatus.APPROVED);
    expect(notifications.createForUsers).not.toHaveBeenCalled();
  });

  it('auto-cancels an approved move whose contract is no longer active', async () => {
    contractRow = { id: 'contract-1', status: ContractStatus.ENDED, bookingItemId: 'bi-1' };
    row = buildRequest({ topupInvoiceId: 'inv-1' });

    const result = await service.run(NOW);

    expect(result.cancelled).toBe(1);
    expect(row.status).toBe(ChangeRequestStatus.CANCELLED);
    // The held target went back on sale and the unpaid top-up was voided.
    expect(em.update).toHaveBeenCalledWith(
      StorageUnit,
      { id: 'unit-new', status: StorageUnitStatus.HELD },
      { status: StorageUnitStatus.AVAILABLE },
    );
    expect(em.update).toHaveBeenCalledWith(
      Invoice,
      { id: 'inv-1' },
      { status: InvoiceStatus.VOID },
    );
    const [, userIds, payload] = notifications.createForUsers.mock.calls[0];
    expect(userIds).toEqual(['customer-1']);
    expect(payload.type).toBe(NotificationType.UNIT_CHANGE_CANCELLED);
  });

  it('auto-cancels when the contract already moved to another unit', async () => {
    bookingItemRow = { id: 'bi-1', storageUnitId: 'unit-elsewhere' };

    const result = await service.run(NOW);

    expect(result.cancelled).toBe(1);
    expect(row.status).toBe(ChangeRequestStatus.CANCELLED);
  });

  it('auto-cancels a stale REQUESTED nobody ever decided on', async () => {
    row = buildRequest({ status: ChangeRequestStatus.REQUESTED, moveAt: YESTERDAY });

    const result = await service.run(NOW);

    expect(result.cancelled).toBe(1);
    expect(row.status).toBe(ChangeRequestStatus.CANCELLED);
    // Nothing was ever held — no unit write.
    expect(em.update).not.toHaveBeenCalledWith(StorageUnit, expect.anything(), expect.anything());
  });

  it('leaves a fresh REQUESTED alone', async () => {
    row = buildRequest({ status: ChangeRequestStatus.REQUESTED, moveAt: new Date() });

    const result = await service.run(NOW);

    expect(result).toEqual({ started: 0, reminded: 0, cancelled: 0 });
  });

  it('reminds managers when a move has been TRANSITIONING for over a week', async () => {
    row = buildRequest({
      status: ChangeRequestStatus.TRANSITIONING,
      transitionStartAt: new Date(NOW.getTime() - 10 * 86400_000),
      moveAt: new Date(NOW.getTime() - 10 * 86400_000),
    });

    const result = await service.run(NOW);

    expect(result).toEqual({ started: 0, reminded: 1, cancelled: 0 });
    expect(row.status).toBe(ChangeRequestStatus.TRANSITIONING);
    const [, userIds] = notifications.createForUsers.mock.calls[0];
    expect(new Set(userIds)).toEqual(new Set(['mgr-a', 'mgr-b']));
  });

  it('auto-cancels a TRANSITIONING move on a dead contract instead of reminding', async () => {
    row = buildRequest({
      status: ChangeRequestStatus.TRANSITIONING,
      transitionStartAt: new Date(NOW.getTime() - 10 * 86400_000),
      moveAt: new Date(NOW.getTime() - 10 * 86400_000),
      topupInvoiceId: 'inv-1',
    });
    contractRow = { id: 'contract-1', status: ContractStatus.ENDED, bookingItemId: 'bi-1' };

    const result = await service.run(NOW);

    expect(result).toEqual({ started: 0, reminded: 0, cancelled: 1 });
    expect(row.status).toBe(ChangeRequestStatus.CANCELLED);
  });

  it('keeps a paid top-up invoice when auto-cancelling', async () => {
    row = buildRequest({ topupInvoiceId: 'inv-1' });
    contractRow = { id: 'contract-1', status: ContractStatus.ENDED, bookingItemId: 'bi-1' };
    succeededPayments = 1;

    await service.run(NOW);

    expect(em.update).not.toHaveBeenCalledWith(Invoice, expect.anything(), expect.anything());
    expect(row.status).toBe(ChangeRequestStatus.CANCELLED);
  });

  it('does nothing when another instance holds the advisory lock', async () => {
    advisoryGranted = false;

    const result = await service.run(NOW);

    expect(result).toEqual({ started: 0, reminded: 0, cancelled: 0 });
    expect(runnerManagerFind).not.toHaveBeenCalled();
  });

  it('skips a request whose status moved on under the row lock', async () => {
    // The candidate list said APPROVED; by the time the row locked it was CANCELLED.
    runnerManagerFind.mockResolvedValue([{ id: 'req-1' }]);
    row = buildRequest({ status: ChangeRequestStatus.CANCELLED });

    const result = await service.run(NOW);

    expect(result).toEqual({ started: 0, reminded: 0, cancelled: 0 });
    expect(notifications.createForUsers).not.toHaveBeenCalled();
  });
});
