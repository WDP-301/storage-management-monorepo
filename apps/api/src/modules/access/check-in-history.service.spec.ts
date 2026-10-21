import type { AccessEvent } from '@entities/access-event.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { UserRole } from '@storage/types';
import { toCheckInView } from './check-in.view';
import { CheckInHistoryService } from './check-in-history.service';

const actor = (id: string, roles: UserRole[]) => ({ id, roles }) as AuthUser;

describe('CheckInHistoryService.list', () => {
  let qb: Record<string, jest.Mock>;
  let assignments: Record<string, unknown>[];
  let service: CheckInHistoryService;

  beforeEach(() => {
    qb = {};
    for (const m of [
      'withDeleted',
      'innerJoinAndSelect',
      'leftJoinAndSelect',
      'where',
      'andWhere',
      'orderBy',
      'addOrderBy',
      'skip',
      'take',
    ]) {
      qb[m] = jest.fn(() => qb);
    }
    qb.getManyAndCount = jest.fn().mockResolvedValue([[], 45]);
    assignments = [
      {
        userId: 'fm-1',
        role: UserRole.FACILITY_MANAGER,
        facilityId: 'f-1',
        startsAt: new Date('2020-01-01T00:00:00Z'),
        endsAt: null,
      },
    ];
    const repo = { createQueryBuilder: jest.fn(() => qb) };
    const dataSource = { manager: { find: jest.fn(async () => assignments) } };
    service = new CheckInHistoryService(repo as never, dataSource as never);
  });

  const scopeCall = () => qb.andWhere.mock.calls.find(([sql]) => sql.includes('facilityId IN'));

  it('includes soft-deleted rows and only used passes, with pagination meta', async () => {
    const result = await service.list(actor('a', [UserRole.ADMIN]), { page: 2, limit: 20 });

    expect(qb.withDeleted).toHaveBeenCalled();
    expect(qb.where).toHaveBeenCalledWith('pass.usedAt IS NOT NULL');
    expect(qb.skip).toHaveBeenCalledWith(20);
    expect(result.meta).toEqual({ page: 2, limit: 20, total: 45, totalPages: 3 });
    expect(scopeCall()).toBeUndefined();
  });

  it('limits a facility manager to the facilities they manage', async () => {
    await service.list(actor('fm-1', [UserRole.FACILITY_MANAGER]), {});
    expect(scopeCall()?.[1]).toEqual({ scope: ['f-1'] });
  });

  it('returns an empty page when facilityId is outside the managed scope', async () => {
    const result = await service.list(actor('fm-1', [UserRole.FACILITY_MANAGER]), {
      facilityId: 'f-9',
    });

    expect(result).toEqual({ checkIns: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    expect(qb.getManyAndCount).not.toHaveBeenCalled();
  });

  it('lets a global manager narrow to any facility', async () => {
    await service.list(actor('a', [UserRole.OPERATIONS_MANAGER]), { facilityId: 'f-9' });
    expect(scopeCall()?.[1]).toEqual({ scope: ['f-9'] });
  });
});

describe('toCheckInView', () => {
  it('renders the customer, warehouse, facility and verifier', () => {
    const view = toCheckInView({
      id: 'p-1',
      usedAt: new Date('2026-03-01T00:00:00Z'),
      customer: { fullName: 'An', phone: '09' },
      warehouse: { code: 'W-1', name: 'Wh' },
      facility: { code: 'F-1', name: 'HCM' },
      verifier: { id: 'u-1', fullName: 'Staff' },
    } as unknown as AccessEvent);

    expect(view).toMatchObject({
      customer: { fullName: 'An', phone: '09' },
      warehouse: { code: 'W-1' },
      facility: { code: 'F-1' },
      verifiedBy: { id: 'u-1', fullName: 'Staff' },
    });
  });

  it('survives missing joined records', () => {
    const view = toCheckInView({ id: 'p-1' } as AccessEvent);

    expect(view).toMatchObject({ warehouse: null, verifiedBy: null, customer: { fullName: null } });
  });
});
