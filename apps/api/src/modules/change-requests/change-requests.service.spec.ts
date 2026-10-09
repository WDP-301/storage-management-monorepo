import { BookingItem } from '@entities/booking-item.entity';
import { UnitChangeRequest } from '@entities/unit-change-request.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { SettingsService } from '@modules/settings/settings.service';
import { ChangeRequestStatus, ContractStatus, StorageUnitStatus, UserRole } from '@storage/types';
import { ChangeRequestsService } from './change-requests.service';

const FACILITY_ID = 'facility-1';
const CUSTOMER_ID = 'customer-1';

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
    rentDifference: 400000,
    depositDifference: 0,
    oldUnit: { id: 'unit-old', code: 'A-01', facilityId: FACILITY_ID },
    newUnit: {
      id: 'unit-new',
      code: 'A-02',
      facilityId: FACILITY_ID,
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
    startsAt: new Date(Date.now() - 60_000),
    endsAt: undefined,
    ...overrides,
  }) as UserRoleAssignment;

function lockedRow(
  entity: unknown,
  bookedUnitId: string,
  requestStatus: ChangeRequestStatus = ChangeRequestStatus.REQUESTED,
) {
  if (entity === UnitChangeRequest) return { id: 'req-1', status: requestStatus };
  if (entity === BookingItem) return { id: 'bi-1', storageUnitId: bookedUnitId };
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
  let storageUnits: { findOne: jest.Mock };
  let roleAssignments: { find: jest.Mock };
  let txManager: {
    createQueryBuilder: jest.Mock;
    update: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    count: jest.Mock;
  };
  let settings: SettingsService;
  let service: ChangeRequestsService;

  beforeEach(() => {
    requests = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(buildRequest()),
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
        bookingItem: {
          id: 'bi-1',
          storageUnit: { id: 'unit-old', facilityId: FACILITY_ID },
          monthlyPriceSnapshot: 550000,
          depositSnapshot: 550000,
        },
      }),
    };
    storageUnits = { findOne: jest.fn() };
    roleAssignments = { find: jest.fn().mockResolvedValue([activeAssignment()]) };
    txManager = {
      createQueryBuilder: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn(async (v) => v),
      // Locked re-reads: the request is still undecided, the contract is still active and
      // still on the old unit.
      findOne: jest.fn(async (entity: unknown) => lockedRow(entity, 'unit-old')),
      count: jest.fn().mockResolvedValue(0),
    };
    const claimBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    txManager.createQueryBuilder.mockReturnValue(claimBuilder);

    // Real resolution logic; only the stored system-wide level is stubbed.
    settings = Object.assign(Object.create(SettingsService.prototype), {
      getDepositDefaultMonths: jest.fn().mockResolvedValue(2),
    });

    service = new ChangeRequestsService(
      requests as never,
      contracts as never,
      storageUnits as never,
      roleAssignments as never,
      { transaction: jest.fn(async (fn: (m: unknown) => unknown) => fn(txManager)) } as never,
      settings,
    );
  });

  it('create rejects when the contract already has an open request', async () => {
    storageUnits.findOne.mockResolvedValue({
      id: 'unit-new',
      facilityId: FACILITY_ID,
      status: StorageUnitStatus.AVAILABLE,
      monthlyPrice: '950000.00',
    });
    requests.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
    });

    await expect(
      service.create({ contractId: 'contract-1', newUnitId: 'unit-new', reason: 'x' }, customer),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('approve performs the swap and completes the request', async () => {
    const request = buildRequest();
    requests.findOne.mockResolvedValue(request);

    const result = await service.decide('req-1', { decision: 'APPROVED' }, manager);

    expect(request.status).toBe(ChangeRequestStatus.COMPLETED);
    expect(request.approvedBy).toBe('manager-1');
    expect(txManager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'unit-old' },
      { status: StorageUnitStatus.MAINTENANCE },
    );
    expect(result.request.status).toBe(ChangeRequestStatus.COMPLETED);
  });

  it('approve snapshots the system-wide deposit level for a unit without its own', async () => {
    await service.decide('req-1', { decision: 'APPROVED' }, manager);

    expect(txManager.update).toHaveBeenCalledWith(
      BookingItem,
      expect.anything(),
      expect.objectContaining({ monthlyPriceSnapshot: 950000, depositSnapshot: 1900000 }),
    );
  });

  it('approve snapshots the target unit own deposit level', async () => {
    requests.findOne.mockResolvedValue(
      buildRequest({
        newUnit: {
          id: 'unit-new',
          code: 'A-02',
          facilityId: FACILITY_ID,
          depositMonths: 3,
          monthlyPrice: '950000.00',
        },
      } as never),
    );

    await service.decide('req-1', { decision: 'APPROVED' }, manager);

    expect(txManager.update).toHaveBeenCalledWith(
      BookingItem,
      expect.anything(),
      expect.objectContaining({ depositSnapshot: 2850000 }),
    );
  });

  it('approve refuses while the contract has a return in progress', async () => {
    txManager.count.mockResolvedValue(1);

    await expect(service.decide('req-1', { decision: 'APPROVED' }, manager)).rejects.toMatchObject({
      status: 409,
    });
    expect(txManager.update).not.toHaveBeenCalled();
  });

  it('approve refuses a request made from a unit the contract has already left', async () => {
    txManager.findOne.mockImplementation(async (entity: unknown) =>
      lockedRow(entity, 'unit-elsewhere'),
    );

    await expect(service.decide('req-1', { decision: 'APPROVED' }, manager)).rejects.toMatchObject({
      status: 409,
    });
    expect(txManager.update).not.toHaveBeenCalled();
  });

  it('approve fails when the target unit was already taken', async () => {
    txManager.createQueryBuilder.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    });

    await expect(service.decide('req-1', { decision: 'APPROVED' }, manager)).rejects.toMatchObject({
      status: 409,
    });
    expect(txManager.save).not.toHaveBeenCalled();
  });

  it('reject marks the request without touching units', async () => {
    const request = buildRequest();
    requests.findOne.mockResolvedValue(request);

    const result = await service.decide(
      'req-1',
      { decision: 'REJECTED', decisionNote: 'no' },
      manager,
    );

    expect(result.request.status).toBe(ChangeRequestStatus.REJECTED);
    expect(txManager.update).not.toHaveBeenCalled();
  });

  it.each(['APPROVED', 'REJECTED'] as const)(
    '%s refuses a request another manager decided concurrently',
    async (decision) => {
      txManager.findOne.mockImplementation(async (entity: unknown) =>
        lockedRow(entity, 'unit-old', ChangeRequestStatus.COMPLETED),
      );

      await expect(service.decide('req-1', { decision }, manager)).rejects.toMatchObject({
        status: 409,
      });
      expect(txManager.save).not.toHaveBeenCalled();
      expect(txManager.update).not.toHaveBeenCalled();
    },
  );

  it('denies a manager who is not assigned to the request facility', async () => {
    roleAssignments.find.mockResolvedValue([activeAssignment({ facilityId: 'other-facility' })]);

    await expect(service.decide('req-1', { decision: 'APPROVED' }, manager)).rejects.toMatchObject({
      status: 403,
    });
  });
});
