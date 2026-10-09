import { Facility } from '@entities/facility.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { UserRole } from '@storage/types';
import { In } from 'typeorm';
import { FacilitiesService } from './facilities.service';

const buildAssignment = (overrides: Partial<UserRoleAssignment> = {}): UserRoleAssignment =>
  ({
    id: 'assignment-1',
    userId: 'user-1',
    role: UserRole.FACILITY_MANAGER,
    facilityId: 'facility-1',
    startsAt: new Date('2024-01-01T00:00:00Z'),
    endsAt: undefined,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }) as UserRoleAssignment;

const buildFacility = (id: string): Facility => ({ id }) as Facility;

describe('FacilitiesService', () => {
  let facilityRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
    manager: { query: jest.Mock };
  };
  let roleAssignments: { find: jest.Mock };
  let service: FacilitiesService;

  beforeEach(() => {
    facilityRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(),
      manager: { query: jest.fn().mockResolvedValue([]) },
    };
    roleAssignments = { find: jest.fn().mockResolvedValue([]) };

    service = new FacilitiesService(facilityRepo as never, roleAssignments as never);
  });

  describe('findForAdmin', () => {
    it('adds the live warehouse count to each facility, zero when it has none', async () => {
      const qb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest
          .fn()
          .mockResolvedValue([[buildFacility('facility-1'), buildFacility('facility-2')], 2]),
      };
      facilityRepo.createQueryBuilder.mockReturnValue(qb);
      facilityRepo.manager.query.mockResolvedValue([{ facility_id: 'facility-1', count: '3' }]);

      const { facilities, meta } = await service.findForAdmin({});

      expect(facilities.map((f) => [f.id, f.warehouseCount])).toEqual([
        ['facility-1', 3],
        ['facility-2', 0],
      ]);
      expect(meta.total).toBe(2);
      expect(facilityRepo.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at IS NULL'),
        [['facility-1', 'facility-2']],
      );
    });
  });

  describe('findAssigned', () => {
    it('returns every facility a manager is actively assigned to', async () => {
      roleAssignments.find.mockResolvedValue([
        buildAssignment({ facilityId: 'facility-1' }),
        buildAssignment({ id: 'assignment-2', facilityId: 'facility-2' }),
      ]);
      facilityRepo.find.mockResolvedValue([
        buildFacility('facility-1'),
        buildFacility('facility-2'),
      ]);

      const result = await service.findAssigned('user-1');

      expect(result.map((facility) => facility.id)).toEqual(['facility-1', 'facility-2']);
      expect(facilityRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: expect.anything() }) }),
      );
    });

    it('skips expired assignments and dedupes a facility held under two roles', async () => {
      roleAssignments.find.mockResolvedValue([
        buildAssignment({ facilityId: 'facility-1' }),
        buildAssignment({
          id: 'assignment-2',
          role: UserRole.FACILITY_STAFF,
          facilityId: 'facility-1',
        }),
        buildAssignment({
          id: 'assignment-3',
          facilityId: 'facility-2',
          endsAt: new Date('2024-06-01T00:00:00Z'),
        }),
      ]);
      facilityRepo.find.mockResolvedValue([buildFacility('facility-1')]);

      const result = await service.findAssigned('user-1');

      expect(result.map((facility) => facility.id)).toEqual(['facility-1']);
      const whereArg = facilityRepo.find.mock.calls[0][0].where;
      expect(whereArg.id).toEqual(In(['facility-1']));
    });

    it('returns an empty list without hitting the facility table when nothing is assigned', async () => {
      const result = await service.findAssigned('user-1');

      expect(result).toEqual([]);
      expect(facilityRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('findStaff', () => {
    const staffRow = (userId: string, fullName: string, overrides = {}) =>
      buildAssignment({
        userId,
        role: UserRole.FACILITY_STAFF,
        user: { id: userId, fullName, phone: null } as never,
        ...overrides,
      });

    it('lists active staff of a facility the manager manages, deduped and sorted', async () => {
      roleAssignments.find
        .mockResolvedValueOnce([buildAssignment({ userId: 'manager-1' })])
        .mockResolvedValueOnce([
          staffRow('s-2', 'Trần B'),
          staffRow('s-1', 'Nguyễn A'),
          staffRow('s-1', 'Nguyễn A', { id: 'dup' }),
          staffRow('s-3', 'Lê C', { endsAt: new Date('2025-01-01T00:00:00Z') }),
        ]);

      await expect(
        service.findStaff('facility-1', {
          id: 'manager-1',
          roles: [UserRole.FACILITY_MANAGER],
        } as never),
      ).resolves.toEqual([
        { id: 's-1', fullName: 'Nguyễn A', phone: null },
        { id: 's-2', fullName: 'Trần B', phone: null },
      ]);
    });

    it('forbids a manager of another facility', async () => {
      roleAssignments.find.mockResolvedValueOnce([buildAssignment({ facilityId: 'facility-2' })]);

      await expect(
        service.findStaff('facility-1', {
          id: 'user-1',
          roles: [UserRole.FACILITY_MANAGER],
        } as never),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('lets operations list any facility', async () => {
      await expect(
        service.findStaff('facility-1', {
          id: 'ops',
          roles: [UserRole.OPERATIONS_MANAGER],
        } as never),
      ).resolves.toEqual([]);
    });
  });
});
