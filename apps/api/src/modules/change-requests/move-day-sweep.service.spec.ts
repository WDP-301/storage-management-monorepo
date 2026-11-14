jest.mock('@nestjs/schedule', () => ({ Cron: () => () => undefined }));

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
const LONG_AGO = new Date(NOW.getTime() - 20 * 86400_000);

const buildRequest = (overrides: Record<string, unknown> = {}): UnitChangeRequest =>
  ({
    id: 'req-1',
    contractId: 'contract-1',
    oldUnitId: 'unit-old',
    newUnitId: 'unit-new',
    newContractId: 'contract-new',
    requestedBy: 'customer-1',
    status: ChangeRequestStatus.AWAITING_PAYMENT,
    moveAt: new Date(NOW.getTime() + 86400_000),
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
  let row: UnitChangeRequest;
  let contractRow: unknown;
  let invoiceRow: unknown;
  let unitRow: unknown;
  let assignments: UserRoleAssignment[];
  let em: {
    findOne: jest.Mock;
    find: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    save: jest.Mock;
    query: jest.Mock;
  };
  let runnerManagerFind: jest.Mock;
  let notifications: { createForUsers: jest.Mock };
  let service: MoveDaySweepService;
  let advisoryGranted: boolean;

  beforeEach(() => {
    row = buildRequest();
    contractRow = { id: 'contract-new', status: ContractStatus.DRAFT, bookingItemId: 'bi-new' };
    invoiceRow = { id: 'inv-1', status: InvoiceStatus.ISSUED, invoiceNo: 'INV-1' };
    unitRow = { id: 'unit-new', status: StorageUnitStatus.BOOKED };
    assignments = [activeAssignment('fac-a', 'mgr-a'), activeAssignment('fac-b', 'mgr-b')];
    advisoryGranted = true;

    em = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === UnitChangeRequest) return row;
        if (entity === Contract) return contractRow;
        if (entity === Invoice) return invoiceRow;
        if (entity === StorageUnit) return unitRow;
        return null;
      }),
      find: jest.fn(async (entity: unknown, options?: { where?: { facilityId?: string } }) => {
        if (entity === UserRoleAssignment) {
          const facilityId = options?.where?.facilityId;
          return facilityId ? assignments.filter((a) => a.facilityId === facilityId) : assignments;
        }
        return [];
      }),
      count: jest.fn(async (entity: unknown) => (entity === Payment ? 0 : 0)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn(async (v: unknown) => v),
      query: jest.fn(async () => []),
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
      { assignSafely: jest.fn() } as never,
    );
  });

  it('auto-cancels a stale REQUESTED nobody ever decided on', async () => {
    row = buildRequest({ status: ChangeRequestStatus.REQUESTED, moveAt: YESTERDAY });

    const result = await service.run(NOW);

    expect(result.cancelled).toBe(1);
    expect(row.status).toBe(ChangeRequestStatus.CANCELLED);
    // Nothing was ever held — no unit write.
    expect(em.update).not.toHaveBeenCalledWith(StorageUnit, expect.anything(), expect.anything());
    expect(notifications.createForUsers.mock.calls[0][2].type).toBe(
      NotificationType.UNIT_CHANGE_CANCELLED,
    );
  });

  it('leaves a fresh REQUESTED alone', async () => {
    row = buildRequest({ status: ChangeRequestStatus.REQUESTED, moveAt: new Date() });

    const result = await service.run(NOW);

    expect(result).toEqual({ started: 0, reminded: 0, cancelled: 0 });
  });

  it('leaves an AWAITING_PAYMENT request with a future move day alone', async () => {
    const result = await service.run(NOW);

    expect(result).toEqual({ started: 0, reminded: 0, cancelled: 0 });
    expect(row.status).toBe(ChangeRequestStatus.AWAITING_PAYMENT);
    expect(notifications.createForUsers).not.toHaveBeenCalled();
  });

  it('reminds the managers once an AWAITING_PAYMENT move day has passed', async () => {
    row = buildRequest({ moveAt: YESTERDAY });

    const result = await service.run(NOW);

    expect(result.reminded).toBe(1);
    expect(row.status).toBe(ChangeRequestStatus.AWAITING_PAYMENT);
    const [, userIds, payload] = notifications.createForUsers.mock.calls[0];
    expect(new Set(userIds)).toEqual(new Set(['mgr-a', 'mgr-b']));
    expect(payload.type).toBe(NotificationType.UNIT_CHANGE_MOVE_TODAY);
  });

  it('auto-cancels an AWAITING_PAYMENT move long past its deadline, releasing the hold', async () => {
    row = buildRequest({ moveAt: LONG_AGO, topupInvoiceId: 'inv-1' });

    const result = await service.run(NOW);

    expect(result.cancelled).toBe(1);
    expect(row.status).toBe(ChangeRequestStatus.CANCELLED);
    expect(em.update).toHaveBeenCalledWith(
      StorageUnit,
      { id: 'unit-new', status: StorageUnitStatus.HELD },
      { status: StorageUnitStatus.AVAILABLE },
    );
  });

  it('unwinds a settled move whose destination contract fell over', async () => {
    row = buildRequest({ status: ChangeRequestStatus.AWAITING_HANDOVER });
    contractRow = null;

    const result = await service.run(NOW);

    expect(result.cancelled).toBe(1);
    expect(row.status).toBe(ChangeRequestStatus.CANCELLED);
    // The destination unit is released; the old contract is left untouched.
    expect(em.update).toHaveBeenCalledWith(
      StorageUnit,
      { id: 'unit-new', status: StorageUnitStatus.BOOKED },
      { status: StorageUnitStatus.AVAILABLE },
    );
    expect(em.update).not.toHaveBeenCalledWith(Contract, { id: 'contract-1' }, expect.anything());
  });

  it('reminds both facilities on the handover day of an AWAITING_HANDOVER move', async () => {
    row = buildRequest({ status: ChangeRequestStatus.AWAITING_HANDOVER, moveAt: new Date(NOW) });

    const result = await service.run(NOW);

    expect(result.reminded).toBe(1);
    expect(row.status).toBe(ChangeRequestStatus.AWAITING_HANDOVER);
  });

  it('leaves an AWAITING_HANDOVER move not yet due alone', async () => {
    row = buildRequest({ status: ChangeRequestStatus.AWAITING_HANDOVER });

    const result = await service.run(NOW);

    expect(result).toEqual({ started: 0, reminded: 0, cancelled: 0 });
  });

  it('reminds the destination branch to give the final approval', async () => {
    row = buildRequest({ status: ChangeRequestStatus.AWAITING_FINAL_APPROVAL, moveAt: YESTERDAY });
    contractRow = {
      id: 'contract-new',
      status: ContractStatus.ACTIVE,
      bookingItemId: 'bi-new',
    };

    const result = await service.run(NOW);

    expect(result.reminded).toBe(1);
    expect(row.status).toBe(ChangeRequestStatus.AWAITING_FINAL_APPROVAL);
  });

  it('auto-cancels when the destination contract is no longer valid', async () => {
    row = buildRequest({ status: ChangeRequestStatus.AWAITING_FINAL_APPROVAL });
    contractRow = {
      id: 'contract-new',
      status: ContractStatus.CANCELLED,
      bookingItemId: 'bi-new',
    };

    const result = await service.run(NOW);

    expect(result.cancelled).toBe(1);
    expect(row.status).toBe(ChangeRequestStatus.CANCELLED);
  });

  it('does nothing when another instance holds the advisory lock', async () => {
    advisoryGranted = false;

    const result = await service.run(NOW);

    expect(result).toEqual({ started: 0, reminded: 0, cancelled: 0 });
    expect(runnerManagerFind).not.toHaveBeenCalled();
  });

  it('skips a request whose status moved on under the row lock', async () => {
    runnerManagerFind.mockResolvedValue([{ id: 'req-1' }]);
    row = buildRequest({ status: ChangeRequestStatus.CANCELLED });

    const result = await service.run(NOW);

    expect(result).toEqual({ started: 0, reminded: 0, cancelled: 0 });
    expect(notifications.createForUsers).not.toHaveBeenCalled();
  });
});
