import type { SystemSetting } from '@entities/system-setting.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import type { SettingValueType } from '@storage/types';
import { UserRole, UserStatus } from '@storage/types';
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

/** Metadata now lives on the DB row — the spec mirrors the seeded values for the keys under test. */
const ROW_META: Record<
  string,
  Pick<SystemSetting, 'valueType' | 'group' | 'label' | 'min' | 'max'>
> = {
  'booking.hold_minutes': {
    valueType: 'int',
    group: 'booking',
    label: 'Booking hold time (minutes)',
    min: 1,
    max: 1440,
  },
  'booking.min_rental_months': {
    valueType: 'int',
    group: 'booking',
    label: 'Minimum rental term (months)',
    min: 1,
    max: 60,
  },
  'booking.max_rental_months': {
    valueType: 'int',
    group: 'booking',
    label: 'Maximum rental term (months)',
    min: 1,
    max: 60,
  },
  'booking.rental_months_options': {
    valueType: 'int_list' as SettingValueType,
    group: 'booking',
    label: 'Suggested rental terms (months)',
    min: 1,
    max: 60,
  },
};

const buildSetting = (key: string, value: unknown): SystemSetting =>
  ({
    key,
    value,
    description: null,
    defaultValue: null,
    updatedBy: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...ROW_META[key],
  }) as SystemSetting;

describe('SettingsService', () => {
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let service: SettingsService;

  beforeEach(() => {
    repo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    service = new SettingsService(repo as never);
  });

  describe('get', () => {
    it('returns the stored value', async () => {
      repo.findOne.mockResolvedValue(buildSetting('booking.hold_minutes', 10));

      await expect(service.getBookingHoldMinutes()).resolves.toBe(10);
    });

    it('throws INTERNAL_ERROR when the row is missing', async () => {
      await expect(service.getBookingHoldMinutes()).rejects.toMatchObject({
        status: 500,
        response: { code: 'INTERNAL_ERROR' },
      });
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
    it('updates only value and updated_by, then returns the updated records', async () => {
      repo.find.mockResolvedValue([buildSetting('booking.hold_minutes', 10)]);

      const result = await service.update({ 'booking.hold_minutes': 10 }, buildAdmin());

      expect(repo.update).toHaveBeenCalledWith(
        { key: 'booking.hold_minutes' },
        { value: 10, updatedBy: 'admin-1' },
      );
      expect(result.settings).toHaveLength(1);
      expect(result.settings[0].value).toBe(10);
      expect(result.settings[0].label).toBe('Booking hold time (minutes)');
    });

    it('rejects an empty update', async () => {
      await expect(service.update({}, buildAdmin())).rejects.toMatchObject({
        status: 400,
        response: { code: 'VALIDATION_FAILED' },
      });
    });

    it('rejects keys with no settings row', async () => {
      repo.find.mockResolvedValue([]);

      await expect(service.update({ 'nope.key': 1 }, buildAdmin())).rejects.toMatchObject({
        status: 400,
        response: { code: 'VALIDATION_FAILED' },
      });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('rejects out-of-range values', async () => {
      repo.find.mockResolvedValue([
        buildSetting('booking.hold_minutes', 15),
        buildSetting('booking.max_rental_months', 60),
      ]);

      await expect(
        service.update({ 'booking.hold_minutes': 0 }, buildAdmin()),
      ).rejects.toMatchObject({ status: 400, response: { code: 'VALIDATION_FAILED' } });
      await expect(
        service.update({ 'booking.max_rental_months': 61 }, buildAdmin()),
      ).rejects.toMatchObject({ status: 400, response: { code: 'VALIDATION_FAILED' } });
    });

    it('rejects values of the wrong type', async () => {
      repo.find.mockResolvedValue([buildSetting('booking.hold_minutes', 15)]);

      await expect(
        service.update({ 'booking.hold_minutes': 'abc' }, buildAdmin()),
      ).rejects.toMatchObject({ status: 400, response: { code: 'VALIDATION_FAILED' } });
    });

    it('rejects int_list items outside the allowed range', async () => {
      repo.find.mockResolvedValue([buildSetting('booking.rental_months_options', [6, 12, 18])]);

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
