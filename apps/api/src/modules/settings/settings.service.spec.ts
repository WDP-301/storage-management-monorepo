import type { AuthUser } from '@modules/auth/types/auth-user';
import { UserRole, UserStatus } from '@storage/types';
import type { SystemSetting } from './entities/system-setting.entity';
import { SETTINGS_REGISTRY } from './settings.registry';
import { SettingsService } from './settings.service';

const buildAdmin = (): AuthUser =>
  ({
    id: 'admin-1',
    email: 'admin@example.com',
    fullName: 'Admin',
    status: UserStatus.ACTIVE,
    roles: [UserRole.ADMIN],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  }) as AuthUser;

const buildSetting = (key: string, value: unknown): SystemSetting =>
  ({
    key,
    value,
    valueType: SETTINGS_REGISTRY[key].type,
    group: SETTINGS_REGISTRY[key].group,
    description: null,
    updatedBy: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  }) as SystemSetting;

describe('SettingsService', () => {
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    query: jest.Mock;
  };
  let service: SettingsService;

  beforeEach(() => {
    repo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((rows) => Promise.resolve(rows)),
      create: jest.fn((value) => value),
      query: jest.fn().mockResolvedValue([]),
    };
    service = new SettingsService(repo as never);
  });

  describe('onApplicationBootstrap', () => {
    it('upserts every registry key with its default using an atomic INSERT ON CONFLICT', async () => {
      repo.query.mockResolvedValue(Object.keys(SETTINGS_REGISTRY).map((key) => ({ key })));

      await service.onApplicationBootstrap();

      expect(repo.query).toHaveBeenCalledTimes(1);
      const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO system_settings');
      expect(sql).toContain('ON CONFLICT (key) DO NOTHING');
      expect(params).toHaveLength(Object.keys(SETTINGS_REGISTRY).length * 5);

      const valuesIndex = Object.keys(SETTINGS_REGISTRY).indexOf('booking.hold_minutes');
      expect(params[valuesIndex * 5 + 1]).toBe('15');
      const minMonthsIndex = Object.keys(SETTINGS_REGISTRY).indexOf('booking.min_rental_months');
      expect(params[minMonthsIndex * 5 + 1]).toBe('6');
    });

    it('is idempotent when every key already exists (no rows returned)', async () => {
      repo.query.mockResolvedValue([]);

      await service.onApplicationBootstrap();

      expect(repo.query).toHaveBeenCalledTimes(1);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('returns the stored value', async () => {
      repo.findOne.mockResolvedValue(buildSetting('booking.hold_minutes', 10));

      await expect(service.getBookingHoldMinutes()).resolves.toBe(10);
    });

    it('falls back to the registry default when the row is missing', async () => {
      await expect(service.getBookingHoldMinutes()).resolves.toBe(15);
    });

    it('parses int_list values into numbers', async () => {
      repo.findOne.mockResolvedValue(buildSetting('booking.rental_months_options', [3, 6, 9]));

      await expect(service.getBookingRentalMonthsOptions()).resolves.toEqual([3, 6, 9]);
    });

    it('caches values within the TTL window', async () => {
      repo.findOne.mockResolvedValue(buildSetting('booking.hold_minutes', 20));

      await service.get('booking.hold_minutes');
      await service.get('booking.hold_minutes');

      expect(repo.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('saves valid values with the admin id and returns the updated records', async () => {
      repo.find.mockResolvedValue([buildSetting('booking.hold_minutes', 10)]);

      const result = await service.update({ 'booking.hold_minutes': 10 }, buildAdmin());

      expect(repo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ key: 'booking.hold_minutes', value: 10, updatedBy: 'admin-1' }),
        ]),
      );
      expect(result.settings).toHaveLength(1);
      expect(result.settings[0].value).toBe(10);
    });

    it('rejects an empty update', async () => {
      await expect(service.update({}, buildAdmin())).rejects.toMatchObject({
        status: 400,
        response: { code: 'VALIDATION_FAILED' },
      });
    });

    it('rejects unknown keys', async () => {
      await expect(service.update({ 'nope.key': 1 }, buildAdmin())).rejects.toMatchObject({
        status: 400,
        response: { code: 'VALIDATION_FAILED' },
      });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects out-of-range values', async () => {
      await expect(
        service.update({ 'booking.hold_minutes': 0 }, buildAdmin()),
      ).rejects.toMatchObject({ status: 400, response: { code: 'VALIDATION_FAILED' } });
      await expect(
        service.update({ 'booking.max_rental_months': 61 }, buildAdmin()),
      ).rejects.toMatchObject({ status: 400, response: { code: 'VALIDATION_FAILED' } });
    });

    it('rejects values of the wrong type', async () => {
      await expect(
        service.update({ 'booking.hold_minutes': 'abc' }, buildAdmin()),
      ).rejects.toMatchObject({ status: 400, response: { code: 'VALIDATION_FAILED' } });
    });

    it('rejects int_list items outside the allowed range', async () => {
      await expect(
        service.update({ 'booking.rental_months_options': [0, 6] }, buildAdmin()),
      ).rejects.toMatchObject({ status: 400, response: { code: 'VALIDATION_FAILED' } });
      await expect(
        service.update({ 'booking.rental_months_options': [6, 61] }, buildAdmin()),
      ).rejects.toMatchObject({ status: 400, response: { code: 'VALIDATION_FAILED' } });
    });

    it('invalidates the cache after a successful update', async () => {
      repo.findOne.mockResolvedValue(buildSetting('booking.hold_minutes', 15));
      await service.get('booking.hold_minutes');

      repo.find.mockResolvedValue([buildSetting('booking.hold_minutes', 30)]);
      await service.update({ 'booking.hold_minutes': 30 }, buildAdmin());

      repo.findOne.mockResolvedValue(buildSetting('booking.hold_minutes', 30));
      await expect(service.get('booking.hold_minutes')).resolves.toBe(30);
    });
  });
});
