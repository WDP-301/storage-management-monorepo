import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitChangeRequest } from '@entities/unit-change-request.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import {
  ChangeRequestStatus,
  ContractStatus,
  InspectionType,
  StorageUnitKind,
  StorageUnitStatus,
} from '@storage/types';
import {
  advanceChangeRequestToFinalApproval,
  settleOldContractRent,
} from './change-request-handover.util';
import { UNIT_CHANGE_NOTE } from './change-request-settle.util';

const NOW = new Date('2026-07-01T02:00:00Z');

const buildRequest = (overrides: Partial<UnitChangeRequest> = {}): UnitChangeRequest =>
  ({
    id: 'req-1',
    contractId: 'contract-old',
    oldUnitId: 'unit-old',
    newUnitId: 'unit-new',
    status: ChangeRequestStatus.AWAITING_HANDOVER,
    history: [],
    ...overrides,
  }) as unknown as UnitChangeRequest;

describe('advanceChangeRequestToFinalApproval', () => {
  let request: UnitChangeRequest | null;
  let oldContract: { id: string; status: ContractStatus } | null;
  let updates: {
    entity: unknown;
    where: Record<string, unknown>;
    patch: Record<string, unknown>;
  }[];
  let queries: { sql: string; params: unknown[] }[];
  let em: {
    findOne: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    query: jest.Mock;
  };
  let notifications: { createForUsers: jest.Mock };
  let handoverAssignment: { assignMaintenanceInspection: jest.Mock };

  beforeEach(() => {
    request = buildRequest();
    oldContract = { id: 'contract-old', status: ContractStatus.ACTIVE };
    updates = [];
    queries = [];
    em = {
      findOne: jest.fn(async (entity: unknown, options?: { where?: { id?: string } }) => {
        if (entity === UnitChangeRequest) return request;
        if (entity === Contract) return oldContract;
        if (entity === StorageUnit) {
          return options?.where?.id === 'unit-old'
            ? { id: 'unit-old', code: 'A-01', facilityId: 'fac-1' }
            : { id: 'unit-new', code: 'B-02', facilityId: 'fac-1' };
        }
        return null;
      }),
      find: jest.fn(async () => [] as UserRoleAssignment[]),
      update: jest.fn(async (entity: unknown, where: unknown, patch: unknown) => {
        updates.push({
          entity,
          where: where as Record<string, unknown>,
          patch: patch as Record<string, unknown>,
        });
        return { affected: 1 };
      }),
      save: jest.fn(async (a: unknown, b?: unknown) => (b ?? a) as never),
      create: jest.fn((_entity: unknown, data: unknown) => ({ id: 'insp-1', ...(data as object) })),
      query: jest.fn(async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        return [];
      }),
    };
    notifications = { createForUsers: jest.fn() };
    handoverAssignment = { assignMaintenanceInspection: jest.fn(async () => 'staff-1') };
  });

  it('retires the old contract, moves the deposit and advances the request', async () => {
    const result = await advanceChangeRequestToFinalApproval(
      em as never,
      'contract-new',
      NOW,
      notifications as never,
      handoverAssignment as never,
    );

    expect(result).toBe(request);
    expect(updates).toContainEqual({
      entity: Contract,
      where: { id: 'contract-old' },
      patch: { status: ContractStatus.CANCELLED, note: UNIT_CHANGE_NOTE },
    });
    expect(updates).toContainEqual({
      entity: StorageUnit,
      where: { id: 'unit-old', status: StorageUnitStatus.RENTED },
      patch: { status: StorageUnitStatus.MAINTENANCE },
    });
    expect(
      queries.some(
        (q) =>
          q.sql.includes('UPDATE "deposits"') &&
          q.params[0] === 'contract-new' &&
          q.params[1] === 'contract-old',
      ),
    ).toBe(true);
    // A maintenance check is opened for the vacated old unit and round-robined to facility staff.
    expect(em.create).toHaveBeenCalledWith(
      Inspection,
      expect.objectContaining({ contractId: 'contract-old', type: InspectionType.MAINTENANCE }),
    );
    expect(handoverAssignment.assignMaintenanceInspection).toHaveBeenCalledWith(em, 'insp-1');
    expect(request?.status).toBe(ChangeRequestStatus.AWAITING_FINAL_APPROVAL);
  });

  it('does nothing when the contract is not a change destination', async () => {
    request = null;

    const result = await advanceChangeRequestToFinalApproval(
      em as never,
      'contract-other',
      NOW,
      notifications as never,
      handoverAssignment as never,
    );

    expect(result).toBeNull();
    expect(em.update).not.toHaveBeenCalled();
    expect(em.save).not.toHaveBeenCalled();
  });

  it('skips retiring an old contract that already ended, but still moves the deposit', async () => {
    oldContract = { id: 'contract-old', status: ContractStatus.ENDED };

    await advanceChangeRequestToFinalApproval(
      em as never,
      'contract-new',
      NOW,
      notifications as never,
      handoverAssignment as never,
    );

    expect(updates.some((u) => u.entity === Contract)).toBe(false);
    expect(updates.some((u) => u.entity === StorageUnit)).toBe(false);
    expect(queries.some((q) => q.sql.includes('UPDATE "deposits"'))).toBe(true);
    expect(request?.status).toBe(ChangeRequestStatus.AWAITING_FINAL_APPROVAL);
  });

  it('carries shelf stock and receipt history over on a SHELF -> SHELF move without blocking on items', async () => {
    em.findOne.mockImplementation(
      async (entity: unknown, options?: { where?: { id?: string } }) => {
        if (entity === UnitChangeRequest) return request;
        if (entity === Contract) return oldContract;
        if (entity === StorageUnit) {
          return options?.where?.id === 'unit-old'
            ? { id: 'unit-old', code: 'K-01', facilityId: 'fac-1', kind: StorageUnitKind.SHELF }
            : { id: 'unit-new', code: 'K-02', facilityId: 'fac-1', kind: StorageUnitKind.SHELF };
        }
        return null;
      },
    );

    await advanceChangeRequestToFinalApproval(
      em as never,
      'contract-new',
      NOW,
      notifications as never,
      handoverAssignment as never,
    );

    expect(queries).toContainEqual({
      sql: expect.stringContaining('UPDATE "shelf_items" SET "contract_id" = $1'),
      params: ['contract-new', 'contract-old'],
    });
    expect(queries).toContainEqual({
      sql: expect.stringContaining('UPDATE "shelf_receipts" SET "contract_id" = $1'),
      params: ['contract-new', 'contract-old'],
    });
    expect(request?.status).toBe(ChangeRequestStatus.AWAITING_FINAL_APPROVAL);
  });

  it('settles the old rent into the moved deposit and tells the customer', async () => {
    // Paid month covering the move day: 2026-06-15 → 2026-07-15, move on 2026-07-01.
    em.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (sql.includes('FROM "invoices" i')) {
        return [
          {
            id: 'inv-1',
            status: 'PAID',
            startAt: new Date('2026-06-15T00:00:00+07:00'),
            endAt: new Date('2026-07-15T00:00:00+07:00'),
            total: '1500000',
            paid: '1500000',
          },
        ];
      }
      // The deposit row already exists on the old contract.
      if (sql.includes('deposits')) return [{ id: 'dep-1' }];
      return [];
    });

    await advanceChangeRequestToFinalApproval(
      em as never,
      'contract-new',
      NOW,
      notifications as never,
      handoverAssignment as never,
    );

    // 16 of 30 days used → 800,000 owed → 700,000 credit rides the deposit.
    const depositBump = queries.find(
      (q) => q.sql.includes('UPDATE "deposits"') && q.sql.includes('GREATEST'),
    );
    expect(depositBump?.params[0]).toBe('700000.00');
    expect(notifications.createForUsers).toHaveBeenCalledWith(
      em,
      expect.anything(),
      expect.objectContaining({ type: 'UNIT_CHANGE_RENT_SETTLED' }),
    );
  });
});

describe('settleOldContractRent', () => {
  // Move day in Vietnam: 2026-07-01 (NOW is 09:00 VN that day).
  const MOVE = new Date('2026-07-01T02:00:00Z');

  const emWith = (invoices: unknown[]) => ({
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      void params;
      if (sql.includes('FROM "invoices" i')) return invoices;
      return [[], 0];
    }),
  });

  const inv = (over: Record<string, unknown>) => ({
    id: 'inv-1',
    status: 'PAID',
    startAt: new Date('2026-06-15T00:00:00+07:00'),
    endAt: new Date('2026-07-15T00:00:00+07:00'),
    total: '1500000',
    paid: '1500000',
    ...over,
  });

  it('pro-rates the period covering the move day', async () => {
    const em = emWith([inv({})]);
    // 16 used days of a 30-day period → 800,000 owed, 700,000 credited back.
    const net = await settleOldContractRent(em as never, 'contract-1', MOVE);
    expect(net.toFixed(2)).toBe('700000.00');
    // A PAID invoice is kept as history — nothing is voided.
    expect(
      em.query.mock.calls.some(([sql]) => (sql as string).includes(`SET "status" = 'VOID'`)),
    ).toBe(false);
  });

  it('collects an unpaid elapsed period in full and voids it', async () => {
    const em = emWith([
      inv({
        status: 'ISSUED',
        paid: '0',
        startAt: new Date('2026-05-15T00:00:00+07:00'),
        endAt: new Date('2026-06-15T00:00:00+07:00'),
      }),
    ]);
    const net = await settleOldContractRent(em as never, 'contract-1', MOVE);
    expect(net.toFixed(2)).toBe('-1500000.00');
    const voidCall = em.query.mock.calls.find(([sql]) =>
      (sql as string).includes(`SET "status" = 'VOID'`),
    );
    expect(voidCall?.[1][0]).toEqual(['inv-1']);
  });

  it('charges nothing for an invoice that starts on or after the move day', async () => {
    const em = emWith([
      inv({
        status: 'ISSUED',
        paid: '0',
        startAt: new Date('2026-07-01T00:00:00+07:00'),
        endAt: new Date('2026-08-01T00:00:00+07:00'),
      }),
    ]);
    const net = await settleOldContractRent(em as never, 'contract-1', MOVE);
    expect(net.toFixed(2)).toBe('0.00');
    // Still voided — the time it billed will never be used.
    expect(
      em.query.mock.calls.some(([sql]) => (sql as string).includes(`SET "status" = 'VOID'`)),
    ).toBe(true);
  });
});
