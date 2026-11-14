import { AppUser } from '@entities/app-user.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Facility } from '@entities/facility.entity';
import { Inspection } from '@entities/inspection.entity';
import { Invoice } from '@entities/invoice.entity';
import { Payment } from '@entities/payment.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitChangeRequest } from '@entities/unit-change-request.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { SettingsService } from '@modules/settings/settings.service';
import {
  ChangeRequestStatus,
  ContractStatus,
  FacilityStatus,
  InvoiceKind,
  InvoiceStatus,
  NotificationType,
  StorageUnitKind,
  StorageUnitStatus,
  UserRole,
} from '@storage/types';
import { In } from 'typeorm';
import { ChangeRequestsService } from './change-requests.service';

const FACILITY_ID = 'facility-1';
const CUSTOMER_ID = 'customer-1';
// An instant inside OFFICE hours (09:00 VN) tomorrow — `create` validates the move time now.
const TOMORROW = () => {
  const at = new Date(Date.now() + 24 * 60 * 60 * 1000);
  at.setUTCHours(2, 0, 0, 0);
  return at.toISOString();
};
// 20:00 VN tomorrow — a valid day, but outside the OFFICE shift.
const TOMORROW_EVENING = () => {
  const at = new Date(Date.now() + 24 * 60 * 60 * 1000);
  at.setUTCHours(13, 0, 0, 0);
  return at.toISOString();
};

const manager: AuthUser = {
  id: 'manager-1',
  email: 'm@test.dev',
  fullName: 'Mgr',
  status: 'ACTIVE',
  roles: [UserRole.FACILITY_MANAGER],
  createdAt: new Date(),
  updatedAt: new Date(),
} as AuthUser;

const customer: AuthUser = {
  id: CUSTOMER_ID,
  email: 'c@test.dev',
  fullName: 'Cust',
  status: 'ACTIVE',
  roles: [UserRole.CUSTOMER],
  createdAt: new Date(),
  updatedAt: new Date(),
} as AuthUser;

const createDto = (overrides: Record<string, unknown> = {}) => ({
  contractId: 'contract-1',
  newUnitId: 'unit-new',
  reason: 'x',
  scheduledMoveAt: TOMORROW(),
  ...overrides,
});

const buildRequest = (overrides: Partial<UnitChangeRequest> = {}): UnitChangeRequest =>
  ({
    id: 'req-1',
    contractId: 'contract-1',
    oldUnitId: 'unit-old',
    newUnitId: 'unit-new',
    requestedBy: CUSTOMER_ID,
    reason: 'need more space',
    status: ChangeRequestStatus.REQUESTED,
    history: [],
    moveAt: new Date(TOMORROW()),
    rentDifference: 400000,
    // Matches the mocked target: 950000 * 2 deposit months - 550000 deposit snapshot.
    depositDifference: 1350000,
    oldUnit: {
      id: 'unit-old',
      code: 'A-01',
      facilityId: FACILITY_ID,
      kind: StorageUnitKind.SELF_STORAGE,
    },
    newUnit: {
      id: 'unit-new',
      code: 'A-02',
      facilityId: FACILITY_ID,
      kind: StorageUnitKind.SELF_STORAGE,
      monthlyPrice: '950000.00',
    },
    requester: { id: CUSTOMER_ID, fullName: 'Cust', email: 'c@test.dev' },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as unknown as UnitChangeRequest;

const activeAssignment = (overrides: Partial<UserRoleAssignment> = {}): UserRoleAssignment =>
  ({
    role: UserRole.FACILITY_MANAGER,
    facilityId: FACILITY_ID,
    userId: 'manager-1',
    startsAt: new Date(Date.now() - 60_000),
    endsAt: undefined,
    ...overrides,
  }) as UserRoleAssignment;

function lockedRow(
  entity: unknown,
  bookedUnitId: string,
  requestRow: UnitChangeRequest,
  persistedStatus: ChangeRequestStatus | undefined,
) {
  if (entity === UnitChangeRequest) {
    // The locked re-read is a fresh row: the service may already have mutated the in-memory
    // copy it loaded earlier, so the locked view restores the status as persisted (or to the
    // override a test set to simulate a race).
    return { ...requestRow, status: persistedStatus ?? requestRow.status };
  }
  if (entity === Facility) return { id: FACILITY_ID, status: FacilityStatus.ACTIVE };
  if (entity === BookingItem)
    return {
      id: 'bi-1',
      storageUnitId: bookedUnitId,
      rentalMonths: 3,
      depositSnapshot: 550000,
      monthlyPriceSnapshot: 550000,
    };
  if (entity === StorageUnit)
    // The destination unit as the settle step's HELD-check reads it.
    return {
      id: 'unit-new',
      code: 'A-02',
      status: StorageUnitStatus.HELD,
      facilityId: FACILITY_ID,
      facility: { id: FACILITY_ID, status: FacilityStatus.ACTIVE },
    };
  if (entity === Invoice) return { id: 'inv-1', status: InvoiceStatus.ISSUED, invoiceNo: 'INV-1' };
  return { id: 'contract-1', status: ContractStatus.ACTIVE, bookingItemId: 'bi-1' };
}

describe('ChangeRequestsService', () => {
  let requests: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let contracts: { findOne: jest.Mock };
  let storageUnits: { findOne: jest.Mock; find: jest.Mock };
  let roleAssignments: { find: jest.Mock };
  let shiftTemplates: { find: jest.Mock };
  let txManager: {
    find: jest.Mock;
    create: jest.Mock;
    createQueryBuilder: jest.Mock;
    update: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    count: jest.Mock;
    findOneByOrFail: jest.Mock;
    query: jest.Mock;
  };
  /** Goods on the shelf of the contract — none unless a test sets them. */
  let shelfRows: { id: string; name: string; quantity: number }[];
  /** Open RETURN inspections reported by the standalone count in `create`. */
  let openReturns: number;
  /** Succeeded payments on the top-up invoice reported in `cancel`. */
  let succeededPayments: number;
  /** What `txManager.find` returns for UserRoleAssignment rows (manager lookups). */
  let managerAssignments: UserRoleAssignment[];
  let notifications: { createForUsers: jest.Mock };
  let handoverAssignment: { assignSafely: jest.Mock; assignPendingForFacility: jest.Mock };
  let settings: SettingsService;
  let service: ChangeRequestsService;
  /** The request row as persisted — shared between the outer find and the locked re-read. */
  let requestRow: UnitChangeRequest;
  /** Status the outer find saw — the locked re-read restores it before checking. */
  let persistedStatus: ChangeRequestStatus | undefined;
  /** Override the locked view's status to simulate a decision racing in mid-call. */
  let requestStatus: ChangeRequestStatus | undefined;

  beforeEach(() => {
    requestRow = buildRequest();
    persistedStatus = undefined;
    requestStatus = undefined;
    openReturns = 0;
    succeededPayments = 0;
    managerAssignments = [activeAssignment()];
    requests = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(async () => {
        persistedStatus = requestRow.status;
        return requestRow;
      }),
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => v),
      createQueryBuilder: jest.fn(),
    };
    contracts = {
      findOne: jest.fn().mockResolvedValue({
        id: 'contract-1',
        customerId: CUSTOMER_ID,
        status: ContractStatus.ACTIVE,
        bookingItemId: 'bi-1',
        contractNo: 'HD-001',
        bookingItem: {
          id: 'bi-1',
          storageUnit: {
            id: 'unit-old',
            facilityId: FACILITY_ID,
            kind: StorageUnitKind.SELF_STORAGE,
          },
          monthlyPriceSnapshot: 550000,
          depositSnapshot: 550000,
        },
      }),
    };
    storageUnits = { findOne: jest.fn(), find: jest.fn().mockResolvedValue([]) };
    roleAssignments = { find: jest.fn().mockResolvedValue([activeAssignment()]) };
    shiftTemplates = {
      find: jest.fn().mockResolvedValue([{ startTime: '08:00', endTime: '17:00' }]),
    };
    shelfRows = [];
    txManager = {
      // TypeORM returns [rows, affected] for UPDATE ... RETURNING and the bare rows otherwise.
      query: jest.fn(async (sql: string) =>
        sql.trimStart().startsWith('UPDATE') ? [[], 0] : shelfRows,
      ),
      find: jest.fn(async (entity: unknown) =>
        entity === UserRoleAssignment ? managerAssignments : [],
      ),
      create: jest.fn((_entity: unknown, data: unknown) => ({ id: 'gen-1', ...(data as object) })),
      createQueryBuilder: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      // save(Entity, data) returns the row it wrote; save(entity) returns the entity — and
      // persists the request row back so the post-transaction findOrFail sees the new state.
      save: jest.fn(async (a: unknown, b?: unknown) => {
        const v = b ?? a;
        if (v && typeof v === 'object' && (v as { id?: string }).id === 'req-1') {
          Object.assign(requestRow, v);
        }
        return v;
      }),
      // Locked re-reads: the request is still undecided, the contract is still active and
      // still on the old unit, the destination unit is still HELD.
      findOne: jest.fn(async (entity: unknown) =>
        lockedRow(entity, 'unit-old', requestRow, requestStatus ?? persistedStatus),
      ),
      findOneOrFail: jest.fn(async (entity: unknown) =>
        entity === AppUser
          ? { id: CUSTOMER_ID, fullName: 'Cust', email: 'c@test.dev' }
          : lockedRow(entity, 'unit-old', requestRow, requestStatus ?? persistedStatus),
      ),
      count: jest.fn(async (entity: unknown) => {
        if (entity === Inspection) return openReturns;
        if (entity === Payment) return succeededPayments;
        return 0;
      }),
      // Target unit as stored when the claim took its row lock.
      findOneByOrFail: jest
        .fn()
        .mockResolvedValue({ id: 'unit-new', monthlyPrice: '950000.00', code: 'A-02' }),
    };
    const claimBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    txManager.createQueryBuilder.mockReturnValue(claimBuilder);
    notifications = { createForUsers: jest.fn() };
    handoverAssignment = { assignSafely: jest.fn(), assignPendingForFacility: jest.fn() };

    // Real resolution logic; only the stored system-wide level is stubbed.
    settings = Object.assign(Object.create(SettingsService.prototype), {
      getDepositDefaultMonths: jest.fn().mockResolvedValue(2),
    });

    service = new ChangeRequestsService(
      requests as never,
      contracts as never,
      storageUnits as never,
      roleAssignments as never,
      shiftTemplates as never,
      {
        transaction: jest.fn(async (fn: (m: unknown) => unknown) => fn(txManager)),
        getRepository: jest.fn().mockReturnValue({
          count: jest.fn(async () => openReturns),
        }),
      } as never,
      settings,
      notifications as never,
      handoverAssignment as never,
    );
  });

  describe('create', () => {
    it('rejects a target warehouse whose facility is not active', async () => {
      storageUnits.findOne.mockResolvedValue({
        id: 'unit-new',
        facilityId: 'fac-off',
        facility: { id: 'fac-off', status: FacilityStatus.INACTIVE },
        status: StorageUnitStatus.AVAILABLE,
        kind: StorageUnitKind.SELF_STORAGE,
        monthlyPrice: '950000.00',
      });

      await expect(service.create(createDto(), customer)).rejects.toMatchObject({
        status: 400,
      });
      expect(requests.save).not.toHaveBeenCalled();
    });

    it('rejects when the contract already has an open request', async () => {
      storageUnits.findOne.mockResolvedValue({
        id: 'unit-new',
        facilityId: FACILITY_ID,
        facility: { id: FACILITY_ID, status: FacilityStatus.ACTIVE },
        status: StorageUnitStatus.AVAILABLE,
        kind: StorageUnitKind.SELF_STORAGE,
        monthlyPrice: '950000.00',
      });
      requests.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
      });

      await expect(service.create(createDto(), customer)).rejects.toMatchObject({
        status: 409,
      });
    });

    it('rejects when the contract has a return in progress', async () => {
      openReturns = 1;

      await expect(service.create(createDto(), customer)).rejects.toMatchObject({
        status: 409,
      });
      expect(storageUnits.findOne).not.toHaveBeenCalled();
    });

    it('rejects a move day outside today..+90 days', async () => {
      await expect(
        service.create(createDto({ scheduledMoveAt: '2020-01-01' }), customer),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        service.create(
          createDto({ scheduledMoveAt: new Date(Date.now() + 120 * 86400_000).toISOString() }),
          customer,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(storageUnits.findOne).not.toHaveBeenCalled();
    });

    it('rejects a move time outside the OFFICE shift', async () => {
      await expect(
        service.create(createDto({ scheduledMoveAt: TOMORROW_EVENING() }), customer),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          details: { fields: [expect.objectContaining({ code: 'moveTimeNotInShift' })] },
        },
      });
      expect(storageUnits.findOne).not.toHaveBeenCalled();
    });

    it('rejects a move time in the past', async () => {
      await expect(
        service.create(
          createDto({ scheduledMoveAt: new Date(Date.now() - 60_000).toISOString() }),
          customer,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(storageUnits.findOne).not.toHaveBeenCalled();
    });

    it('rejects a target of a different kind', async () => {
      storageUnits.findOne.mockResolvedValue({
        id: 'unit-new',
        facilityId: FACILITY_ID,
        facility: { id: FACILITY_ID, status: FacilityStatus.ACTIVE },
        status: StorageUnitStatus.AVAILABLE,
        kind: StorageUnitKind.SHELF,
        parent: { status: StorageUnitStatus.AVAILABLE },
        monthlyPrice: '950000.00',
      });

      await expect(service.create(createDto(), customer)).rejects.toMatchObject({
        status: 400,
        response: {
          details: { fields: [expect.objectContaining({ code: 'kindMismatch' })] },
        },
      });
      expect(requests.save).not.toHaveBeenCalled();
    });

    it.each([
      ['a shelf warehouse', { kind: StorageUnitKind.SHELF_WAREHOUSE, parent: null }],
      [
        'a shelf under a closed warehouse',
        { kind: StorageUnitKind.SHELF, parent: { status: StorageUnitStatus.MAINTENANCE } },
      ],
    ])('rejects %s as the target', async (_label, extra) => {
      contracts.findOne.mockResolvedValue({
        id: 'contract-1',
        customerId: CUSTOMER_ID,
        status: ContractStatus.ACTIVE,
        bookingItemId: 'bi-1',
        contractNo: 'HD-001',
        bookingItem: {
          id: 'bi-1',
          storageUnit: { id: 'unit-old', facilityId: FACILITY_ID, kind: StorageUnitKind.SHELF },
          monthlyPriceSnapshot: 550000,
          depositSnapshot: 550000,
        },
      });
      storageUnits.findOne.mockResolvedValue({
        id: 'unit-new',
        facilityId: FACILITY_ID,
        facility: { id: FACILITY_ID, status: FacilityStatus.ACTIVE },
        status: StorageUnitStatus.AVAILABLE,
        monthlyPrice: '950000.00',
        ...extra,
      });

      await expect(service.create(createDto(), customer)).rejects.toMatchObject({
        status: 400,
      });
      expect(requests.save).not.toHaveBeenCalled();
    });

    it('allows moving onto a shelf of an open warehouse', async () => {
      contracts.findOne.mockResolvedValue({
        id: 'contract-1',
        customerId: CUSTOMER_ID,
        status: ContractStatus.ACTIVE,
        bookingItemId: 'bi-1',
        contractNo: 'HD-001',
        bookingItem: {
          id: 'bi-1',
          storageUnit: { id: 'unit-old', facilityId: FACILITY_ID, kind: StorageUnitKind.SHELF },
          monthlyPriceSnapshot: 550000,
          depositSnapshot: 550000,
        },
      });
      storageUnits.findOne.mockResolvedValue({
        id: 'unit-new',
        facilityId: FACILITY_ID,
        facility: { id: FACILITY_ID, status: FacilityStatus.ACTIVE },
        status: StorageUnitStatus.AVAILABLE,
        kind: StorageUnitKind.SHELF,
        parent: { status: StorageUnitStatus.AVAILABLE },
        monthlyPrice: '950000.00',
      });
      requests.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      });

      await service.create(createDto(), customer);

      expect(requests.save).toHaveBeenCalledWith(
        expect.objectContaining({ moveAt: expect.any(Date) }),
      );
    });
  });

  describe('options', () => {
    it('lists same-kind available units with price and deposit deltas', async () => {
      storageUnits.find.mockResolvedValue([
        {
          id: 'unit-a',
          code: 'A-02',
          name: 'Kho A-02',
          facilityId: FACILITY_ID,
          facility: { id: FACILITY_ID, name: 'CN 1', status: FacilityStatus.ACTIVE },
          status: StorageUnitStatus.AVAILABLE,
          kind: StorageUnitKind.SELF_STORAGE,
          monthlyPrice: '950000.00',
          areaM2: '10.00',
        },
        {
          id: 'unit-old',
          code: 'A-01',
          name: 'Kho A-01',
          facilityId: FACILITY_ID,
          facility: { id: FACILITY_ID, name: 'CN 1', status: FacilityStatus.ACTIVE },
          status: StorageUnitStatus.AVAILABLE,
          kind: StorageUnitKind.SELF_STORAGE,
          monthlyPrice: '550000.00',
        },
      ]);

      const result = await service.options({ contractId: 'contract-1' } as never, customer);

      expect(result.options).toHaveLength(1);
      expect(result.options[0].unit.id).toBe('unit-a');
      expect(result.options[0].unit.facility_name).toBe('CN 1');
      expect(result.options[0].rent_difference).toBe(400000);
      expect(result.options[0].deposit_difference).toBe(1900000 - 550000);
    });

    it('honours a per-unit deposit level over the system default', async () => {
      storageUnits.find.mockResolvedValue([
        {
          id: 'unit-b',
          code: 'B-01',
          name: 'Kho B-01',
          facilityId: FACILITY_ID,
          facility: { id: FACILITY_ID, name: 'CN 1' },
          status: StorageUnitStatus.AVAILABLE,
          kind: StorageUnitKind.SELF_STORAGE,
          monthlyPrice: '1000000.00',
          depositMonths: 3,
        },
      ]);

      const result = await service.options({ contractId: 'contract-1' } as never, customer);

      expect(result.options[0].deposit_difference).toBe(3000000 - 550000);
    });

    it("scopes options to the caller's own contract", async () => {
      contracts.findOne.mockResolvedValue({
        id: 'contract-1',
        customerId: 'someone-else',
        status: ContractStatus.ACTIVE,
        bookingItemId: 'bi-1',
      });

      await expect(
        service.options({ contractId: 'contract-1' } as never, customer),
      ).rejects.toMatchObject({ status: 400 });
      expect(storageUnits.find).not.toHaveBeenCalled();
    });
  });

  describe('decide', () => {
    it('approve holds the target unit and waits for the deposit top-up', async () => {
      const claim = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      txManager.createQueryBuilder.mockReturnValue(claim);
      const request = buildRequest();
      requestRow = request;

      const result = await service.decide('req-1', { decision: 'APPROVED' }, manager);

      expect(claim.set).toHaveBeenCalledWith({ status: StorageUnitStatus.HELD });
      const [condition] = claim.where.mock.calls[0];
      expect(condition).toContain('status = :available');
      // A top-up is billed, so the request waits for payment instead of settling.
      expect(result.request.status).toBe(ChangeRequestStatus.AWAITING_PAYMENT);
      // The contract must not be repointed yet.
      expect(txManager.update).not.toHaveBeenCalledWith(
        BookingItem,
        expect.anything(),
        expect.anything(),
      );
      expect(handoverAssignment.assignSafely).not.toHaveBeenCalled();
    });

    it('approve requires a move day for legacy requests that carry none', async () => {
      requestRow = buildRequest({ moveAt: undefined });

      await expect(
        service.decide('req-1', { decision: 'APPROVED' }, manager),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          details: { fields: [expect.objectContaining({ field: 'moveAt' })] },
        },
      });
    });

    it('approve rejects a move day outside the allowed range', async () => {
      await expect(
        service.decide(
          'req-1',
          { decision: 'APPROVED', moveAt: new Date(Date.now() + 200 * 86400_000).toISOString() },
          manager,
        ),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('approve issues a deposit top-up invoice due on the move day', async () => {
      const request = buildRequest();
      requestRow = request;
      const moveAt = TOMORROW();

      const result = await service.decide('req-1', { decision: 'APPROVED', moveAt }, manager);

      expect(txManager.save).toHaveBeenCalledWith(
        Invoice,
        expect.objectContaining({
          kind: InvoiceKind.DEPOSIT_TOPUP,
          status: InvoiceStatus.ISSUED,
          total: 1900000 - 550000,
          dueAt: new Date(moveAt),
        }),
      );
      expect(request.topupInvoiceId).toBeDefined();
      // Billing a top-up leaves the request waiting for payment, not settled.
      expect(result.request.status).toBe(ChangeRequestStatus.AWAITING_PAYMENT);
      const [, userIds, payload] = notifications.createForUsers.mock.calls[0];
      expect(userIds).toEqual([CUSTOMER_ID]);
      expect(payload.type).toBe(NotificationType.INVOICE_ISSUED);
      const approveCall = notifications.createForUsers.mock.calls.find(
        (c) => c[2].type === NotificationType.UNIT_CHANGE_APPROVED && c[1].includes(CUSTOMER_ID),
      );
      expect(approveCall).toBeDefined();
      // The destination facility hears about the incoming move too.
      const managerCall = notifications.createForUsers.mock.calls.find(
        (c) => c[2].type === NotificationType.UNIT_CHANGE_APPROVED && c[1].includes('manager-1'),
      );
      expect(managerCall).toBeDefined();
      expect(handoverAssignment.assignSafely).not.toHaveBeenCalled();
    });

    it('approve defers the top-up no further than a week out', async () => {
      requestRow = buildRequest();
      const moveAt = new Date(Date.now() + 60 * 86400_000).toISOString();

      await service.decide('req-1', { decision: 'APPROVED', moveAt }, manager);

      const invoice = txManager.save.mock.calls.find((c) => c[0] === Invoice)?.[1];
      const weekOut = Date.now() + 7 * 86400_000;
      expect(invoice.dueAt.getTime()).toBeLessThanOrEqual(weekOut + 60_000);
      expect(invoice.dueAt.getTime()).toBeLessThan(new Date(moveAt).getTime());
    });

    it('approve settles inline and moves to AWAITING_HANDOVER when the deposit does not rise', async () => {
      txManager.findOneByOrFail.mockResolvedValue({
        id: 'unit-new',
        monthlyPrice: '100000.00',
        code: 'A-02',
      });
      const request = buildRequest({ depositDifference: 100000 * 2 - 550000 });
      requestRow = request;

      const result = await service.decide('req-1', { decision: 'APPROVED' }, manager);

      // Nothing to pay: the whole settle step runs inside this one approval.
      expect(txManager.save).not.toHaveBeenCalledWith(
        Invoice,
        expect.objectContaining({ kind: InvoiceKind.DEPOSIT_TOPUP }),
      );
      expect(request.topupInvoiceId).toBeUndefined();
      expect(result.request.status).toBe(ChangeRequestStatus.AWAITING_HANDOVER);
      expect(result.request.new_contract_id).toBeDefined();
      expect(result.request.new_booking_id).toBeDefined();
      expect(handoverAssignment.assignSafely).toHaveBeenCalledWith(txManager, expect.any(String));
      // No top-up invoice means no INVOICE_ISSUED ping.
      expect(
        notifications.createForUsers.mock.calls.some(
          (c) => c[2].type === NotificationType.INVOICE_ISSUED,
        ),
      ).toBe(false);
    });

    it('approve share-locks the target shelf warehouse before claiming the shelf', async () => {
      const request = buildRequest();
      request.oldUnit = { ...request.oldUnit, kind: StorageUnitKind.SHELF } as StorageUnit;
      request.newUnit = {
        ...request.newUnit,
        kind: StorageUnitKind.SHELF,
        parentId: 'parent-1',
      } as StorageUnit;
      requestRow = request;

      await service.decide('req-1', { decision: 'APPROVED' }, manager);

      expect(txManager.find).toHaveBeenCalledWith(
        StorageUnit,
        expect.objectContaining({
          where: { id: In(['parent-1']) },
          lock: { mode: 'pessimistic_read' },
        }),
      );
      expect(txManager.find.mock.invocationCallOrder[0]).toBeLessThan(
        txManager.createQueryBuilder.mock.invocationCallOrder[0],
      );
    });

    it('approve refuses a legacy cross-kind request outright', async () => {
      const request = buildRequest();
      request.oldUnit = { ...request.oldUnit, kind: StorageUnitKind.SHELF } as StorageUnit;
      requestRow = request;

      await expect(
        service.decide('req-1', { decision: 'APPROVED' }, manager),
      ).rejects.toMatchObject({ status: 409 });
      expect(txManager.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('approve fails when the target unit was already taken', async () => {
      txManager.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      });

      await expect(
        service.decide('req-1', { decision: 'APPROVED' }, manager),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('approve refuses while the contract has a return in progress', async () => {
      openReturns = 1;

      await expect(
        service.decide('req-1', { decision: 'APPROVED' }, manager),
      ).rejects.toMatchObject({ status: 409 });
    });

    it.each([
      ['inactive', { id: FACILITY_ID, status: FacilityStatus.INACTIVE } as Facility | null],
      ['deleted', null],
    ])('approve fails when the target facility is %s', async (_label, facilityRow) => {
      txManager.findOne.mockImplementation(async (entity: unknown) =>
        entity === Facility
          ? facilityRow
          : lockedRow(entity, 'unit-old', requestRow, requestStatus ?? persistedStatus),
      );

      await expect(
        service.decide('req-1', { decision: 'APPROVED' }, manager),
      ).rejects.toMatchObject({ status: 409 });
      expect(txManager.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('reject marks the request and tells the customer', async () => {
      const result = await service.decide(
        'req-1',
        { decision: 'REJECTED', decisionNote: 'no' },
        manager,
      );

      expect(result.request.status).toBe(ChangeRequestStatus.REJECTED);
      expect(txManager.update).not.toHaveBeenCalled();
      const [, userIds, payload] = notifications.createForUsers.mock.calls[0];
      expect(userIds).toEqual([CUSTOMER_ID]);
      expect(payload.type).toBe(NotificationType.UNIT_CHANGE_REJECTED);
    });

    it.each(['APPROVED', 'REJECTED'] as const)(
      '%s refuses a request another manager decided concurrently',
      async (decision) => {
        requestStatus = ChangeRequestStatus.COMPLETED;

        await expect(service.decide('req-1', { decision }, manager)).rejects.toMatchObject({
          status: 409,
        });
        expect(txManager.save).not.toHaveBeenCalled();
        expect(txManager.update).not.toHaveBeenCalled();
      },
    );

    it('denies a manager who is not assigned to the request facility', async () => {
      roleAssignments.find.mockResolvedValue([activeAssignment({ facilityId: 'other-facility' })]);

      await expect(
        service.decide('req-1', { decision: 'APPROVED' }, manager),
      ).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('finalApprove', () => {
    it('completes the request without touching the old unit (retired at handover)', async () => {
      requestRow = buildRequest({
        status: ChangeRequestStatus.AWAITING_FINAL_APPROVAL,
        newContractId: 'contract-new',
      });

      const result = await service.finalApprove('req-1', manager);

      expect(txManager.update).not.toHaveBeenCalledWith(
        StorageUnit,
        expect.anything(),
        expect.anything(),
      );
      expect(result.request.status).toBe(ChangeRequestStatus.COMPLETED);
      expect(result.request.final_approved_by).toBe('manager-1');
      expect(result.request.final_approved_at).toBeInstanceOf(Date);
      const completeCall = notifications.createForUsers.mock.calls.find(
        (c) => c[2].type === NotificationType.UNIT_CHANGE_COMPLETED && c[1].includes(CUSTOMER_ID),
      );
      expect(completeCall).toBeDefined();
    });

    it.each([
      ChangeRequestStatus.REQUESTED,
      ChangeRequestStatus.AWAITING_PAYMENT,
      ChangeRequestStatus.AWAITING_HANDOVER,
    ])('refuses to complete a request still in %s', async (status) => {
      requestRow = buildRequest({ status, newContractId: 'contract-new' });

      await expect(service.finalApprove('req-1', manager)).rejects.toMatchObject({ status: 409 });
      expect(txManager.save).not.toHaveBeenCalled();
    });

    it('refuses when the destination contract has not gone active', async () => {
      requestRow = buildRequest({
        status: ChangeRequestStatus.AWAITING_FINAL_APPROVAL,
        newContractId: 'contract-new',
      });
      txManager.findOne.mockImplementation(async (entity: unknown) =>
        entity === Contract
          ? { id: 'contract-new', status: ContractStatus.CANCELLED }
          : lockedRow(entity, 'unit-old', requestRow, requestStatus ?? persistedStatus),
      );

      await expect(service.finalApprove('req-1', manager)).rejects.toMatchObject({ status: 409 });
      expect(txManager.update).not.toHaveBeenCalled();
    });

    it('denies a manager who manages neither facility on the move', async () => {
      requestRow = buildRequest({
        status: ChangeRequestStatus.AWAITING_FINAL_APPROVAL,
        newContractId: 'contract-new',
      });
      roleAssignments.find.mockResolvedValue([activeAssignment({ facilityId: 'other-facility' })]);

      await expect(service.finalApprove('req-1', manager)).rejects.toMatchObject({ status: 403 });
      expect(txManager.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('lets the customer withdraw their own request while it awaits a decision', async () => {
      const result = await service.cancel('req-1', customer);

      const saved = txManager.save.mock.calls[0][0];
      expect(saved.status).toBe(ChangeRequestStatus.CANCELLED);
      // The managers on both ends are told the request is gone.
      const [, userIds, payload] = notifications.createForUsers.mock.calls[0];
      expect(userIds).toEqual(['manager-1']);
      expect(payload.type).toBe(NotificationType.UNIT_CHANGE_CANCELLED);
      expect(result.request.status).toBe(ChangeRequestStatus.CANCELLED);
    });

    it('lets the customer withdraw while the deposit top-up is still unpaid', async () => {
      requestRow = buildRequest({ status: ChangeRequestStatus.AWAITING_PAYMENT });

      const result = await service.cancel('req-1', customer);

      // The held unit goes back and nothing was committed.
      expect(txManager.update).toHaveBeenCalledWith(
        StorageUnit,
        { id: 'unit-new', status: StorageUnitStatus.HELD },
        { status: StorageUnitStatus.AVAILABLE },
      );
      expect(result.request.status).toBe(ChangeRequestStatus.CANCELLED);
    });

    it("hides another customer's request", async () => {
      requestRow = buildRequest({ requestedBy: 'someone-else' });

      await expect(service.cancel('req-1', customer)).rejects.toMatchObject({ status: 404 });
    });

    it('refuses a customer cancel once the move is under way', async () => {
      requestRow = buildRequest({ status: ChangeRequestStatus.AWAITING_HANDOVER });

      await expect(service.cancel('req-1', customer)).rejects.toMatchObject({ status: 409 });
      expect(txManager.save).not.toHaveBeenCalled();
    });

    it('manager cancel releases the held unit and voids an unpaid top-up', async () => {
      requestRow = buildRequest({
        status: ChangeRequestStatus.AWAITING_PAYMENT,
        topupInvoiceId: 'inv-1',
      });

      await service.cancel('req-1', manager);

      expect(txManager.update).toHaveBeenCalledWith(
        StorageUnit,
        { id: 'unit-new', status: StorageUnitStatus.HELD },
        { status: StorageUnitStatus.AVAILABLE },
      );
      expect(txManager.update).toHaveBeenCalledWith(
        Invoice,
        { id: 'inv-1' },
        { status: InvoiceStatus.VOID },
      );
      const [, userIds, payload] = notifications.createForUsers.mock.calls[0];
      expect(userIds).toEqual([CUSTOMER_ID]);
      expect(payload.type).toBe(NotificationType.UNIT_CHANGE_CANCELLED);
    });

    it('manager cancel keeps a paid top-up but still releases and cancels', async () => {
      requestRow = buildRequest({
        status: ChangeRequestStatus.AWAITING_PAYMENT,
        topupInvoiceId: 'inv-1',
      });
      succeededPayments = 1;

      const result = await service.cancel('req-1', manager);

      // The money already sits in the held deposit — the invoice stays for settlement.
      expect(txManager.update).toHaveBeenCalledWith(
        StorageUnit,
        { id: 'unit-new', status: StorageUnitStatus.HELD },
        { status: StorageUnitStatus.AVAILABLE },
      );
      expect(txManager.update).not.toHaveBeenCalledWith(
        Invoice,
        expect.anything(),
        expect.anything(),
      );
      expect(result.request.status).toBe(ChangeRequestStatus.CANCELLED);
    });

    it('manager cancel of a pending request touches no units', async () => {
      await service.cancel('req-1', manager);

      expect(txManager.update).not.toHaveBeenCalledWith(
        StorageUnit,
        expect.anything(),
        expect.anything(),
      );
    });

    it('manager cancel of a settled move unwinds the destination contract', async () => {
      requestRow = buildRequest({
        status: ChangeRequestStatus.AWAITING_HANDOVER,
        newContractId: 'contract-new',
      });
      txManager.findOne.mockImplementation(
        async (entity: unknown, options?: { where?: { id?: string } }) => {
          if (entity === Contract && options?.where?.id === 'contract-new') {
            return { id: 'contract-new', status: ContractStatus.DRAFT };
          }
          return lockedRow(entity, 'unit-old', requestRow, requestStatus ?? persistedStatus);
        },
      );

      const result = await service.cancel('req-1', manager);

      // The destination draft contract is cancelled and its unit returned; the old contract stays.
      expect(txManager.update).toHaveBeenCalledWith(
        Contract,
        { id: 'contract-new' },
        { status: ContractStatus.CANCELLED, note: 'Huỷ do rút yêu cầu đổi kho' },
      );
      expect(txManager.update).toHaveBeenCalledWith(
        StorageUnit,
        { id: 'unit-new', status: StorageUnitStatus.BOOKED },
        { status: StorageUnitStatus.AVAILABLE },
      );
      expect(txManager.update).not.toHaveBeenCalledWith(
        Contract,
        { id: 'contract-1' },
        expect.anything(),
      );
      expect(result.request.status).toBe(ChangeRequestStatus.CANCELLED);
    });
  });
});
