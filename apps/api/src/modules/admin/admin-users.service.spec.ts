import { AppUser } from '@modules/users/entities/app-user.entity';
import { UserRoleAssignment } from '@modules/users/entities/user-role-assignment.entity';
import { UserRole, UserStatus } from '@storage/types';
import { AdminUsersService } from './admin-users.service';

const buildUser = (overrides: Partial<AppUser> = {}): AppUser =>
  ({
    id: 'user-1',
    email: 'user@example.com',
    phone: '0912345678',
    fullName: 'Test User',
    passwordHash: 'scrypt$deadbeef$cafe',
    status: UserStatus.ACTIVE,
    emailVerifiedAt: undefined,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }) as AppUser;

const buildAssignment = (overrides: Partial<UserRoleAssignment> = {}): UserRoleAssignment =>
  ({
    id: 'assignment-1',
    userId: 'user-1',
    role: UserRole.ADMIN,
    facilityId: undefined,
    startsAt: new Date('2024-01-01T00:00:00Z'),
    endsAt: undefined,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }) as UserRoleAssignment;

const buildQueryBuilder = (rows: AppUser[], total: number) => ({
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
});

describe('AdminUsersService', () => {
  let users: { createQueryBuilder: jest.Mock; findOne: jest.Mock; save: jest.Mock };
  let roleAssignments: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let facilities: { findOne: jest.Mock };
  let sessions: { update: jest.Mock };
  let service: AdminUsersService;

  beforeEach(() => {
    users = { createQueryBuilder: jest.fn(), findOne: jest.fn(), save: jest.fn((u) => u) };
    roleAssignments = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    facilities = { findOne: jest.fn().mockResolvedValue({ id: 'facility-1' }) };
    sessions = { update: jest.fn().mockResolvedValue({ affected: 1 }) };

    service = new AdminUsersService(
      users as never,
      roleAssignments as never,
      facilities as never,
      sessions as never,
    );
  });

  describe('listUsers', () => {
    it('paginates, filters, and attaches role assignments in a single extra query', async () => {
      const builder = buildQueryBuilder([buildUser()], 25);
      users.createQueryBuilder.mockReturnValue(builder);
      roleAssignments.find.mockResolvedValue([buildAssignment()]);

      const result = await service.listUsers({
        page: 2,
        limit: 10,
        search: '  Nguy%en ',
        status: UserStatus.ACTIVE,
        role: UserRole.ADMIN,
      });

      expect(builder.skip).toHaveBeenCalledWith(10);
      expect(builder.take).toHaveBeenCalledWith(10);
      expect(builder.andWhere).toHaveBeenCalledWith(expect.stringContaining('LIKE :search'), {
        search: '%nguy\\%en%',
      });
      expect(builder.andWhere).toHaveBeenCalledWith(expect.stringContaining('"user"."status"'), {
        status: UserStatus.ACTIVE,
      });
      expect(builder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('"ura"."starts_at" <= now()'),
        { role: UserRole.ADMIN },
      );

      expect(result.meta).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
      expect(result.users).toHaveLength(1);
      expect(result.users[0].roles).toEqual([
        {
          id: 'assignment-1',
          role: UserRole.ADMIN,
          facilityId: null,
          startsAt: new Date('2024-01-01T00:00:00Z'),
          endsAt: null,
        },
      ]);
      expect(result.users[0]).not.toHaveProperty('passwordHash');
    });

    it('skips the assignment query when the page is empty', async () => {
      users.createQueryBuilder.mockReturnValue(buildQueryBuilder([], 0));

      const result = await service.listUsers({});

      expect(roleAssignments.find).not.toHaveBeenCalled();
      expect(result.users).toEqual([]);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
    });
  });

  describe('getUser', () => {
    it('rejects an unknown user', async () => {
      users.findOne.mockResolvedValue(null);

      await expect(service.getUser('user-1')).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('returns the user with its assignments', async () => {
      users.findOne.mockResolvedValue(buildUser());
      roleAssignments.find.mockResolvedValue([buildAssignment()]);

      const result = await service.getUser('user-1');

      expect(result.user.id).toBe('user-1');
      expect(result.user.roles[0].role).toBe(UserRole.ADMIN);
    });
  });

  describe('updateStatus', () => {
    it('rejects an admin attempting to suspend their own account', async () => {
      await expect(
        service.updateStatus('admin-1', UserStatus.SUSPENDED, 'admin-1'),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: 'VALIDATION_FAILED' },
      });
      expect(users.save).not.toHaveBeenCalled();
      expect(sessions.update).not.toHaveBeenCalled();
    });

    it('rejects an unknown user', async () => {
      users.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('user-1', UserStatus.SUSPENDED, 'admin-1'),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
      expect(users.save).not.toHaveBeenCalled();
      expect(sessions.update).not.toHaveBeenCalled();
    });

    it('persists the new status and revokes sessions when suspended', async () => {
      users.findOne.mockResolvedValue(buildUser());

      const result = await service.updateStatus('user-1', UserStatus.SUSPENDED, 'admin-1');

      expect(users.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1', status: UserStatus.SUSPENDED }),
      );
      expect(sessions.update).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
      expect(result.user.status).toBe(UserStatus.SUSPENDED);
    });

    it('persists the new status without revoking sessions when active', async () => {
      users.findOne.mockResolvedValue(buildUser({ status: UserStatus.SUSPENDED }));

      const result = await service.updateStatus('user-1', UserStatus.ACTIVE, 'admin-1');

      expect(users.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1', status: UserStatus.ACTIVE }),
      );
      expect(sessions.update).not.toHaveBeenCalled();
      expect(result.user.status).toBe(UserStatus.ACTIVE);
    });
  });

  describe('assignRole', () => {
    it('rejects a facility-scoped role without a facilityId', async () => {
      users.findOne.mockResolvedValue(buildUser());

      await expect(
        service.assignRole('user-1', { role: UserRole.FACILITY_MANAGER }, 'admin-1'),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: { fields: [{ field: 'facilityId', code: 'isNotEmpty' }] },
        },
      });
      expect(roleAssignments.save).not.toHaveBeenCalled();
    });

    it('rejects a global role that carries a facilityId', async () => {
      users.findOne.mockResolvedValue(buildUser());

      await expect(
        service.assignRole('user-1', { role: UserRole.ADMIN, facilityId: 'facility-1' }, 'admin-1'),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: { fields: [{ field: 'facilityId', code: 'isNull' }] },
        },
      });
    });

    it('rejects an unknown facility', async () => {
      users.findOne.mockResolvedValue(buildUser());
      facilities.findOne.mockResolvedValue(null);

      await expect(
        service.assignRole(
          'user-1',
          { role: UserRole.FACILITY_STAFF, facilityId: 'facility-1' },
          'admin-1',
        ),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('rejects an endsAt that is not after startsAt', async () => {
      users.findOne.mockResolvedValue(buildUser());

      await expect(
        service.assignRole(
          'user-1',
          {
            role: UserRole.ADMIN,
            startsAt: '2024-06-01T00:00:00Z',
            endsAt: '2024-05-01T00:00:00Z',
          },
          'admin-1',
        ),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: { fields: [{ field: 'endsAt', code: 'isAfter' }] },
        },
      });
      expect(roleAssignments.save).not.toHaveBeenCalled();
    });

    it('rejects a role the user already holds for the same scope', async () => {
      users.findOne.mockResolvedValue(buildUser());
      roleAssignments.findOne.mockResolvedValue(buildAssignment());

      await expect(
        service.assignRole('user-1', { role: UserRole.ADMIN }, 'admin-1'),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'ROLE_ALREADY_ASSIGNED' },
      });
      expect(roleAssignments.save).not.toHaveBeenCalled();
    });

    it('handles race condition when duplicate assignment throws unique constraint error 23505', async () => {
      users.findOne.mockResolvedValue(buildUser());
      roleAssignments.findOne.mockResolvedValue(null);
      roleAssignments.save.mockRejectedValue({ code: '23505' });

      await expect(
        service.assignRole('user-1', { role: UserRole.ADMIN }, 'admin-1'),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'ROLE_ALREADY_ASSIGNED' },
      });
    });

    it('grants the role and records the assigning admin', async () => {
      users.findOne.mockResolvedValue(buildUser());
      roleAssignments.find.mockResolvedValue([
        buildAssignment({ role: UserRole.FACILITY_MANAGER, facilityId: 'facility-1' }),
      ]);

      const result = await service.assignRole(
        'user-1',
        { role: UserRole.FACILITY_MANAGER, facilityId: 'facility-1' },
        'admin-1',
      );

      expect(roleAssignments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          role: UserRole.FACILITY_MANAGER,
          facilityId: 'facility-1',
          assignedBy: 'admin-1',
        }),
      );
      expect(result.user.roles[0].facilityId).toBe('facility-1');
    });
  });

  describe('revokeRole', () => {
    it('rejects an unknown user', async () => {
      users.findOne.mockResolvedValue(null);

      await expect(service.revokeRole('user-1', 'assignment-1')).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
      expect(roleAssignments.delete).not.toHaveBeenCalled();
    });

    it('deletes the assignment scoped to the user', async () => {
      users.findOne.mockResolvedValue(buildUser());

      await expect(service.revokeRole('user-1', 'assignment-1')).resolves.toEqual({
        revoked: true,
      });
      expect(roleAssignments.delete).toHaveBeenCalledWith({
        id: 'assignment-1',
        userId: 'user-1',
      });
    });

    it('stays idempotent when the assignment matches nothing', async () => {
      users.findOne.mockResolvedValue(buildUser());
      roleAssignments.delete.mockResolvedValue({ affected: 0 });

      await expect(service.revokeRole('user-1', 'assignment-1')).resolves.toEqual({
        revoked: true,
      });
    });
  });
});
