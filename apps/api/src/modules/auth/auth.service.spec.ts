import { AppUser } from '@modules/users/entities/app-user.entity';
import { UserRoleAssignment } from '@modules/users/entities/user-role-assignment.entity';
import { UserRole, UserStatus } from '@storage/types';
import { AuthService } from './auth.service';
import { hashPassword, verifyPassword } from './session.util';

const TTL_MS = 60_000;

const buildUser = (overrides: Partial<AppUser> = {}): AppUser =>
  ({
    id: 'user-1',
    email: 'user@example.com',
    fullName: 'Test User',
    passwordHash: 'scrypt$deadbeef$cafe',
    status: UserStatus.ACTIVE,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }) as AppUser;

const mockQueryBuilder = (repo: { createQueryBuilder: jest.Mock }, result: unknown) => {
  const qb = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(result),
  };
  repo.createQueryBuilder.mockReturnValue(qb);
  return qb;
};

describe('AuthService', () => {
  let users: { createQueryBuilder: jest.Mock; findOne: jest.Mock };
  let sessions: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let roleAssignments: { find: jest.Mock };
  let txManager: { create: jest.Mock; save: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let cookies: { generateToken: jest.Mock; hashToken: jest.Mock; ttlMs: number };
  let service: AuthService;

  beforeEach(() => {
    users = { createQueryBuilder: jest.fn(), findOne: jest.fn() };
    sessions = {
      create: jest.fn((x) => ({ id: 'session-1', ...x })),
      save: jest.fn((x) => Promise.resolve(x)),
      findOne: jest.fn(),
      update: jest.fn(() => Promise.resolve({ affected: 1 })),
    };
    roleAssignments = { find: jest.fn(() => Promise.resolve([])) };
    txManager = {
      create: jest.fn((_entity, value) => ({ ...value })),
      save: jest.fn((x) =>
        Promise.resolve({ id: 'user-1', createdAt: new Date(), updatedAt: new Date(), ...x }),
      ),
    };
    dataSource = { transaction: jest.fn((cb) => cb(txManager)) };
    cookies = {
      generateToken: jest.fn(() => 'raw-token'),
      hashToken: jest.fn((token: string) => `hash:${token}`),
      ttlMs: TTL_MS,
    };

    service = new AuthService(
      users as never,
      sessions as never,
      roleAssignments as never,
      dataSource as never,
      cookies as never,
    );
  });

  describe('register', () => {
    it('rejects an email that is already registered', async () => {
      mockQueryBuilder(users, { id: 'existing' });

      await expect(
        service.register({
          email: 'a@b.com',
          password: 'secret123',
          fullName: 'A',
          phone: '0912345678',
        }),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'EMAIL_ALREADY_REGISTERED' },
      });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('lowercases the email, hashes the password and assigns the CUSTOMER role', async () => {
      mockQueryBuilder(users, null);

      const user = await service.register({
        email: '  User@Example.com ',
        password: 'secret123',
        fullName: 'Test User',
        phone: '0912345678',
      });

      const persisted = txManager.create.mock.calls.find(([entity]) => entity === AppUser)?.[1];
      expect(persisted.email).toBe('user@example.com');
      expect(persisted.phone).toBe('0912345678');
      expect(persisted.passwordHash).not.toBe('secret123');
      expect(await verifyPassword('secret123', persisted.passwordHash)).toBe(true);

      const assignment = txManager.create.mock.calls.find(
        ([entity]) => entity === UserRoleAssignment,
      )?.[1];
      expect(assignment.role).toBe(UserRole.CUSTOMER);
      expect(assignment.userId).toBe('user-1');

      expect(user.roles).toEqual([UserRole.CUSTOMER]);
      expect(user.phone).toBe('0912345678');
      expect(user).not.toHaveProperty('passwordHash');
    });
  });

  describe('login', () => {
    it('rejects an unknown email', async () => {
      mockQueryBuilder(users, null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'x' }),
      ).rejects.toMatchObject({
        status: 401,
        response: { code: 'INVALID_CREDENTIALS' },
      });
    });

    it('rejects an inactive account', async () => {
      mockQueryBuilder(users, buildUser({ status: UserStatus.SUSPENDED }));

      await expect(
        service.login({ email: 'user@example.com', password: 'secret123' }),
      ).rejects.toMatchObject({
        status: 401,
        response: { code: 'INVALID_CREDENTIALS' },
      });
    });

    it('rejects a wrong password', async () => {
      mockQueryBuilder(users, buildUser({ passwordHash: await hashPassword('correct-horse') }));

      await expect(
        service.login({ email: 'user@example.com', password: 'wrong' }),
      ).rejects.toMatchObject({
        status: 401,
        response: { code: 'INVALID_CREDENTIALS' },
      });
    });

    it('returns the public user with active roles on success', async () => {
      mockQueryBuilder(users, buildUser({ passwordHash: await hashPassword('secret123') }));
      roleAssignments.find.mockResolvedValue([
        { role: UserRole.CUSTOMER, startsAt: new Date(Date.now() - 1000), endsAt: undefined },
      ]);

      const user = await service.login({ email: 'USER@example.com', password: 'secret123' });

      expect(user.roles).toEqual([UserRole.CUSTOMER]);
      expect(user).not.toHaveProperty('passwordHash');
    });
  });

  describe('createSession', () => {
    it('stores only the hashed token and returns the raw token with its hash and session id', async () => {
      const { token, sessionTokenHash, sessionId, expiresAt } = await service.createSession(
        'user-1',
        { userAgent: 'jest', ipAddress: '::1' },
      );

      expect(token).toBe('raw-token');
      expect(sessionTokenHash).toBe('hash:raw-token');
      expect(sessionTokenHash).not.toBe(token);
      expect(sessionId).toBe('session-1');
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

      const saved = sessions.save.mock.calls[0][0];
      expect(saved.sessionTokenHash).toBe('hash:raw-token');
      expect(saved.userId).toBe('user-1');
    });
  });

  describe('resolveSession', () => {
    const activeSession = (overrides: Record<string, unknown> = {}) => ({
      id: 'session-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + TTL_MS),
      ...overrides,
    });

    it('returns null when the token is unknown', async () => {
      sessions.findOne.mockResolvedValue(null);

      await expect(service.resolveSession('missing')).resolves.toBeNull();
    });

    it('returns null when the session is revoked', async () => {
      sessions.findOne.mockResolvedValue(activeSession({ revokedAt: new Date() }));

      await expect(service.resolveSession('token')).resolves.toBeNull();
    });

    it('returns null when the session is expired', async () => {
      sessions.findOne.mockResolvedValue(activeSession({ expiresAt: new Date(Date.now() - 1) }));

      await expect(service.resolveSession('token')).resolves.toBeNull();
    });

    it('returns the user and touches lastUsedAt when the session is valid', async () => {
      sessions.findOne.mockResolvedValue(activeSession());
      users.findOne.mockResolvedValue(buildUser());

      const user = await service.resolveSession('token');

      expect(user?.id).toBe('user-1');
      expect(sessions.update).toHaveBeenCalledWith(
        { id: 'session-1' },
        { lastUsedAt: expect.any(Date) },
      );
    });
  });

  describe('revokeSession', () => {
    it('marks the session revoked by token hash', async () => {
      await service.revokeSession('raw-token');

      expect(sessions.update).toHaveBeenCalledWith(
        { sessionTokenHash: 'hash:raw-token' },
        { revokedAt: expect.any(Date) },
      );
    });
  });
});
