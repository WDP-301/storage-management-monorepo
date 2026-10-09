import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { ContractStatus, StorageUnitStatus, UserRole } from '@storage/types';
import { In } from 'typeorm';
import { ContractCancelService } from './contract-cancel.service';

const actor = (id: string, roles: UserRole[]): AuthUser => ({ id, roles }) as AuthUser;

describe('ContractCancelService.cancelDraft', () => {
  let em: { findOne: jest.Mock; findOneOrFail: jest.Mock; find: jest.Mock; update: jest.Mock };
  let contract: Partial<Contract> | null;
  let service: ContractCancelService;

  beforeEach(() => {
    contract = {
      id: 'contract-1',
      contractNo: 'CT-1',
      bookingItemId: 'item-1',
      status: ContractStatus.DRAFT,
    };
    em = {
      findOne: jest.fn(async (entity) => (entity === Contract ? contract : null)),
      findOneOrFail: jest.fn(async (entity) =>
        entity === BookingItem
          ? { storageUnitId: 'unit-1', storageUnit: { facilityId: 'facility-1' } }
          : null,
      ),
      find: jest.fn(async (entity, options) =>
        entity === UserRoleAssignment && options.where.userId === 'manager-1'
          ? [
              {
                userId: 'manager-1',
                role: UserRole.FACILITY_MANAGER,
                facilityId: 'facility-1',
                startsAt: new Date('2024-01-01T00:00:00Z'),
                endsAt: null,
              },
            ]
          : [],
      ),
      update: jest.fn(async () => ({ affected: 1 })),
    };
    service = new ContractCancelService({
      transaction: jest.fn((cb: (e: unknown) => unknown) => cb(em)),
    } as never);
  });

  it('cancels the draft and puts the unit back on the market', async () => {
    const result = await service.cancelDraft(
      'contract-1',
      actor('manager-1', [UserRole.FACILITY_MANAGER]),
    );

    expect(result.status).toBe(ContractStatus.CANCELLED);
    expect(em.update).toHaveBeenCalledWith(
      Contract,
      { id: 'contract-1' },
      { status: ContractStatus.CANCELLED },
    );
    expect(em.update).toHaveBeenCalledWith(
      StorageUnit,
      { id: 'unit-1', status: In([StorageUnitStatus.BOOKED, StorageUnitStatus.HELD]) },
      { status: StorageUnitStatus.AVAILABLE },
    );
  });

  it('refuses a contract that already started', async () => {
    contract = { ...contract, status: ContractStatus.ACTIVE };

    await expect(
      service.cancelDraft('contract-1', actor('ops-1', [UserRole.OPERATIONS_MANAGER])),
    ).rejects.toMatchObject({ status: 409 });
    expect(em.update).not.toHaveBeenCalled();
  });

  it('refuses a manager of another facility', async () => {
    await expect(
      service.cancelDraft('contract-1', actor('manager-2', [UserRole.FACILITY_MANAGER])),
    ).rejects.toMatchObject({ status: 403 });
    expect(em.update).not.toHaveBeenCalled();
  });
});
