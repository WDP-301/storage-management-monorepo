import { hashPassword, verifyPassword } from '@modules/auth/session.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { Document } from '@modules/misc/entities/document.entity';
import { DocumentType, UserRole, UserStatus } from '@storage/types';
import { QueryFailedError } from 'typeorm';
import { CustomerService } from './customer.service';
import { AppUser } from './entities/app-user.entity';
import { CustomerProfile } from './entities/customer-profile.entity';

const buildUser = (overrides: Partial<AppUser> = {}): AppUser =>
  ({
    id: 'user-1',
    email: 'user@example.com',
    phone: '0912345678',
    fullName: 'Test User',
    status: UserStatus.ACTIVE,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }) as AppUser;

const buildProfile = (overrides: Partial<CustomerProfile> = {}): CustomerProfile =>
  ({
    userId: 'user-1',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }) as CustomerProfile;

const buildDocument = (overrides: Partial<Document> = {}): Document =>
  ({
    id: 'doc-1',
    ownerUserId: 'user-1',
    type: DocumentType.IDENTITY,
    name: 'Identity document',
    fileUrl: 'https://files.example.com/id.png',
    ...overrides,
  }) as Document;

const buildActor = (overrides: Partial<AuthUser> = {}): AuthUser =>
  ({
    id: 'user-1',
    email: 'user@example.com',
    phone: null,
    fullName: 'Test User',
    status: UserStatus.ACTIVE,
    roles: [UserRole.CUSTOMER],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }) as AuthUser;

describe('CustomerService', () => {
  let users: { findOne: jest.Mock; createQueryBuilder: jest.Mock; save: jest.Mock };
  let profiles: { findOne: jest.Mock };
  let documents: { findOne: jest.Mock };
  let manager: { save: jest.Mock; findOne: jest.Mock; create: jest.Mock };
  let dataSource: { transaction: jest.Mock; query: jest.Mock };
  let service: CustomerService;

  const mockPasswordQuery = (result: AppUser | null) => {
    const qb = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(result),
    };
    users.createQueryBuilder.mockReturnValue(qb);
    return qb;
  };

  beforeEach(() => {
    users = {
      findOne: jest.fn().mockResolvedValue(buildUser()),
      createQueryBuilder: jest.fn(),
      save: jest.fn((value) => Promise.resolve(value)),
    };
    profiles = { findOne: jest.fn().mockResolvedValue(null) };
    documents = { findOne: jest.fn().mockResolvedValue(null) };
    manager = {
      save: jest.fn((value) => Promise.resolve(value)),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_entity, value) => ({ ...value })),
    };
    dataSource = {
      transaction: jest.fn((cb) => cb(manager)),
      query: jest.fn().mockResolvedValue([]),
    };

    service = new CustomerService(
      users as never,
      profiles as never,
      documents as never,
      dataSource as never,
    );
  });

  describe('updateProfile', () => {
    it('rejects a non-owner who is not an admin', async () => {
      const actor = buildActor({ id: 'other-user', roles: [UserRole.CUSTOMER] });

      await expect(service.updateProfile('user-1', { fullName: 'X' }, actor)).rejects.toMatchObject(
        {
          status: 403,
          response: { code: 'FORBIDDEN' },
        },
      );
      expect(users.findOne).not.toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('allows the owner to update their own profile', async () => {
      const result = await service.updateProfile('user-1', { fullName: 'New Name' }, buildActor());

      expect(result.user.id).toBe('user-1');
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('allows an admin to update another user profile', async () => {
      users.findOne.mockResolvedValue(buildUser({ id: 'target-user' }));

      const result = await service.updateProfile(
        'target-user',
        { fullName: 'Admin Edit' },
        buildActor({ id: 'admin-1', roles: [UserRole.ADMIN] }),
      );

      expect(result.user.id).toBe('target-user');
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('rejects an unknown user', async () => {
      users.findOne.mockResolvedValue(null);

      await expect(service.updateProfile('user-1', {}, buildActor())).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('updates account fields and upserts the profile and identity document', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ code: '01' }])
        .mockResolvedValueOnce([{ provinceCode: '01' }]);

      const result = await service.updateProfile(
        'user-1',
        {
          fullName: '  New Name ',
          phone: '0987654321',
          addressLine: '123 Le Loi',
          ward: '00008',
          province: '01',
          identityDocument: {
            docNumber: '001234567890',
            fileUrl: 'https://files.example.com/id.png',
          },
        },
        buildActor(),
      );

      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1', fullName: 'New Name', phone: '0987654321' }),
      );
      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', ward: '00008', province: '01' }),
      );
      expect(manager.create).toHaveBeenCalledWith(CustomerProfile, { userId: 'user-1' });
      expect(manager.create).toHaveBeenCalledWith(
        Document,
        expect.objectContaining({ ownerUserId: 'user-1', type: DocumentType.IDENTITY }),
      );
      expect(result.user.id).toBe('user-1');
    });

    it('rejects a new identity document without a file URL', async () => {
      await expect(
        service.updateProfile(
          'user-1',
          { identityDocument: { docNumber: '001234567890' } },
          buildActor(),
        ),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: { fields: [{ field: 'identityDocument.fileUrl', code: 'isNotEmpty' }] },
        },
      });
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('maps a duplicate identity document number to a conflict', async () => {
      const driverError = Object.assign(
        new Error('duplicate key value violates unique constraint'),
        { code: '23505' },
      );
      manager.save.mockRejectedValue(new QueryFailedError('INSERT', [], driverError));

      await expect(
        service.updateProfile(
          'user-1',
          {
            identityDocument: {
              docNumber: '001234567890',
              fileUrl: 'https://files.example.com/id.png',
            },
          },
          buildActor(),
        ),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'VALIDATION_FAILED' },
      });
    });

    it('returns the mapped profile, account and identity document', async () => {
      profiles.findOne.mockResolvedValue(
        buildProfile({
          addressLine: '123 Le Loi',
          ward: '00008',
          province: '01',
          companyName: 'Acme Corp',
          taxCode: '0123456789',
        }),
      );
      documents.findOne.mockResolvedValue(buildDocument({ docNumber: '001234567890' }));

      const result = await service.updateProfile('user-1', {}, buildActor());

      expect(result.profile).toEqual({
        user_id: 'user-1',
        address_line: '123 Le Loi',
        ward: '00008',
        province: '01',
        company_name: 'Acme Corp',
        tax_code: '0123456789',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
        deleted_at: null,
      });
      expect(result.user).toEqual({
        id: 'user-1',
        email: 'user@example.com',
        fullName: 'Test User',
        phone: '0912345678',
        status: UserStatus.ACTIVE,
      });
      expect(result.identityDocument).toEqual({
        docNumber: '001234567890',
        fileUrl: 'https://files.example.com/id.png',
      });
    });

    it('returns a null profile when no customer profile row exists yet', async () => {
      const result = await service.updateProfile('user-1', { fullName: 'New Name' }, buildActor());

      expect(result.profile).toBeNull();
      expect(result.identityDocument).toBeNull();
      expect(result.user.fullName).toBe('New Name');
    });

    it('accepts valid province and ward codes and stores them', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ code: '01' }])
        .mockResolvedValueOnce([{ provinceCode: '01' }]);

      await expect(
        service.updateProfile('user-1', { province: '01', ward: '00008' }, buildActor()),
      ).resolves.toMatchObject({ profile: null });

      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', ward: '00008', province: '01' }),
      );
    });

    it('rejects a ward that does not belong to the selected province', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ code: '01' }])
        .mockResolvedValueOnce([{ provinceCode: '79' }]);

      await expect(
        service.updateProfile('user-1', { province: '01', ward: '00008' }, buildActor()),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: { fields: [{ field: 'ward', code: 'notBelongsToProvince' }] },
        },
      });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects a province code that does not exist', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await expect(
        service.updateProfile('user-1', { province: '99' }, buildActor()),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: { fields: [{ field: 'province', code: 'notFound' }] },
        },
      });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects a ward code that does not exist', async () => {
      dataSource.query.mockResolvedValueOnce([{ code: '01' }]).mockResolvedValueOnce([]);

      await expect(
        service.updateProfile('user-1', { province: '01', ward: '99999' }, buildActor()),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: { fields: [{ field: 'ward', code: 'notFound' }] },
        },
      });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('requires a province whenever a ward is set', async () => {
      dataSource.query.mockResolvedValueOnce([{ provinceCode: '01' }]);

      await expect(
        service.updateProfile('user-1', { ward: '00008' }, buildActor()),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: { fields: [{ field: 'province', code: 'isNotEmpty' }] },
        },
      });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects a stored ward that belongs elsewhere when only the province changes', async () => {
      profiles.findOne.mockResolvedValue(buildProfile({ ward: '00008', province: '01' }));
      dataSource.query
        .mockResolvedValueOnce([{ code: '79' }])
        .mockResolvedValueOnce([{ provinceCode: '01' }]);

      await expect(
        service.updateProfile('user-1', { province: '79' }, buildActor()),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: { fields: [{ field: 'ward', code: 'notBelongsToProvince' }] },
        },
      });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('skips location queries when only the address is updated', async () => {
      await expect(
        service.updateProfile('user-1', { addressLine: '123 Le Loi' }, buildActor()),
      ).resolves.toBeDefined();

      expect(dataSource.query).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    const dto = (overrides: Record<string, unknown> = {}) => ({
      currentPassword: 'OldPassword123',
      newPassword: 'NewPassword123',
      confirmPassword: 'NewPassword123',
      ...overrides,
    });

    it('resolves the user from the session identity, not the request body', async () => {
      const qb = mockPasswordQuery(
        buildUser({ passwordHash: await hashPassword('OldPassword123') }),
      );

      await service.changePassword(buildActor({ id: 'user-1' }), dto());

      expect(qb.where).toHaveBeenCalledWith('user.id = :id', { id: 'user-1' });
    });

    it('changes the password and stores only the hash', async () => {
      const oldPassword = 'OldPassword123';
      const newPassword = 'NewPassword123';
      mockPasswordQuery(buildUser({ passwordHash: await hashPassword(oldPassword) }));

      const result = await service.changePassword(buildActor(), dto({ newPassword }));

      const saved = users.save.mock.calls[0][0];
      expect(saved.passwordHash).not.toBe(newPassword);
      expect(await verifyPassword(newPassword, saved.passwordHash)).toBe(true);
      expect(await verifyPassword(oldPassword, saved.passwordHash)).toBe(false);
      expect(result).toEqual({ message: 'Password changed successfully' });
    });

    it('rejects an incorrect current password', async () => {
      mockPasswordQuery(buildUser({ passwordHash: await hashPassword('OldPassword123') }));

      await expect(
        service.changePassword(buildActor(), dto({ currentPassword: 'WrongPassword1' })),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: { fields: [{ field: 'currentPassword', code: 'invalidCredentials' }] },
        },
      });
      expect(users.save).not.toHaveBeenCalled();
    });

    it('rejects a new password identical to the current one', async () => {
      mockPasswordQuery(buildUser({ passwordHash: await hashPassword('OldPassword123') }));

      await expect(
        service.changePassword(buildActor(), dto({ newPassword: 'OldPassword123' })),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: { fields: [{ field: 'newPassword', code: 'isSameAsCurrent' }] },
        },
      });
      expect(users.save).not.toHaveBeenCalled();
    });

    it('rejects when confirmPassword does not match newPassword', async () => {
      mockPasswordQuery(buildUser({ passwordHash: await hashPassword('OldPassword123') }));

      await expect(
        service.changePassword(buildActor(), dto({ confirmPassword: 'Different123' })),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: { fields: [{ field: 'confirmPassword', code: 'notMatch' }] },
        },
      });
      expect(users.save).not.toHaveBeenCalled();
    });

    it('rejects an account that has no password set', async () => {
      mockPasswordQuery(buildUser({ passwordHash: undefined }));

      await expect(service.changePassword(buildActor(), dto())).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: { fields: [{ field: 'currentPassword', code: 'invalidCredentials' }] },
        },
      });
      expect(users.save).not.toHaveBeenCalled();
    });

    it('rejects when the authenticated user no longer exists', async () => {
      mockPasswordQuery(null);

      await expect(service.changePassword(buildActor(), dto())).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
      expect(users.save).not.toHaveBeenCalled();
    });

    it('propagates database update failures', async () => {
      mockPasswordQuery(buildUser({ passwordHash: await hashPassword('OldPassword123') }));
      users.save.mockRejectedValue(new Error('db error'));

      await expect(service.changePassword(buildActor(), dto())).rejects.toThrow('db error');
    });
  });
});
