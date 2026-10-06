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
  let facilityRepo: { find: jest.Mock; findOne: jest.Mock };
  let roleAssignments: { find: jest.Mock };
  let service: FacilitiesService;

  beforeEach(() => {
    facilityRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    roleAssignments = { find: jest.fn().mockResolvedValue([]) };

    service = new FacilitiesService(facilityRepo as never, roleAssignments as never);
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
});
