import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitChangeRequest } from '@entities/unit-change-request.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import {
  ChangeRequestStatus,
  ContractStatus,
  InspectionType,
  StorageUnitStatus,
} from '@storage/types';
import { advanceChangeRequestToFinalApproval } from './change-request-handover.util';
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
});
