import type { SystemSetting } from '@entities/system-setting.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import type { SettingValueType } from '@storage/types';
import { UserRole, UserStatus } from '@storage/types';
import { In, Not } from 'typeorm';
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
  'contract.return_rules_effective_at': {
    valueType: 'string',
    group: 'contract',
    label: 'Return rules effective at',
    min: undefined,
    max: undefined,
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

  describe('getCheckInQrTtlMinutes', () => {
    it('reads the QR lifetime setting as a number', async () => {
      repo.findOne.mockResolvedValue(buildSetting('access.check_in_qr_ttl_minutes', 10));

      await expect(service.getCheckInQrTtlMinutes()).resolves.toBe(10);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { key: 'access.check_in_qr_ttl_minutes' },
      });
    });
  });

  describe('return rules', () => {
    it('reads the notice days and overstay percentage as numbers', async () => {
      repo.findOne.mockImplementation(({ where: { key } }: { where: { key: string } }) =>
        Promise.resolve(buildSetting(key, { 'contract.return_notice_days': 30 }[key] ?? '150')),
      );

      await expect(service.getReturnNoticeDays()).resolves.toBe(30);
      await expect(service.getOverduePenaltyPercent()).resolves.toBe(150);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { key: 'billing.overdue_penalty_percent' },
      });
    });

    it('parses the go-live timestamp stored by the database', async () => {
      repo.findOne.mockResolvedValue(
        buildSetting('contract.return_rules_effective_at', '2026-10-21T09:20:35.123456+00:00'),
      );

      await expect(service.getReturnRulesEffectiveAt()).resolves.toEqual(
        new Date('2026-10-21T09:20:35.123Z'),
      );
    });

    it.each([null, 42, 'not a date'])(
      'refuses to guess when the go-live value is %p',
      async (value) => {
        repo.findOne.mockResolvedValue(buildSetting('contract.return_rules_effective_at', value));

        await expect(service.getReturnRulesEffectiveAt()).rejects.toMatchObject({
          status: 500,
          response: { code: 'INTERNAL_ERROR' },
        });
      },
    );
  });

  describe('getAll', () => {
    it('leaves the go-live timestamp out of the editable settings', async () => {
      repo.find.mockResolvedValue([buildSetting('booking.hold_minutes', 15)]);

      const result = await service.getAll();

      expect(repo.find).toHaveBeenCalledWith({
        where: { key: Not(In(['contract.return_rules_effective_at'])) },
        order: { group: 'ASC', key: 'ASC' },
      });
      expect(result.settings.map((setting) => setting.key)).toEqual(['booking.hold_minutes']);
    });
  });

  describe('update', () => {
    it('refuses to change the go-live timestamp even though its row exists', async () => {
      repo.find.mockResolvedValue([
        buildSetting('contract.return_rules_effective_at', '2026-10-21T00:00:00Z'),
      ]);

      await expect(
        service.update(
          { 'contract.return_rules_effective_at': '2020-01-01T00:00:00Z' },
          buildAdmin(),
        ),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: {
            fields: [
              {
                field: 'contract.return_rules_effective_at',
                code: 'invalidValue',
                message: 'Unknown setting key',
              },
            ],
          },
        },
      });
      expect(repo.update).not.toHaveBeenCalled();
    });

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

  describe('getClientSettings', () => {
    const stored: Record<string, unknown> = {
      'booking.rental_months_options': [18, 6, 12],
      'booking.default_rental_months': 6,
      'booking.min_rental_months': 6,
      'booking.max_rental_months': 60,
      'booking.lead_days': 30,
      'booking.max_units_per_booking': 4,
      'contract.return_notice_days': 30,
      'billing.overdue_penalty_percent': 100,
    };

    const serve = (overrides: Record<string, unknown> = {}) =>
      repo.findOne.mockImplementation(({ where: { key } }: { where: { key: string } }) =>
        Promise.resolve(buildSetting(key, { ...stored, ...overrides }[key])),
      );

    it('returns the booking rules with options sorted, and the return rules', async () => {
      serve();

      await expect(service.getClientSettings()).resolves.toEqual({
        booking: {
          rentalMonthsOptions: [6, 12, 18],
          defaultRentalMonths: 6,
          minRentalMonths: 6,
          maxRentalMonths: 60,
          leadDays: 30,
          maxUnitsPerBooking: 4,
        },
        return: { noticeDays: 30, overduePenaltyPercent: 100 },
      });
    });

    it('never exposes the go-live timestamp to clients', async () => {
      serve();

      await service.getClientSettings();

      expect(repo.findOne).not.toHaveBeenCalledWith({
        where: { key: 'contract.return_rules_effective_at' },
      });
    });

    it('drops options the booking endpoint would reject and re-picks the default', async () => {
      serve({ 'booking.min_rental_months': 12, 'booking.max_rental_months': 12 });

      const { booking } = await service.getClientSettings();

      expect(booking.rentalMonthsOptions).toEqual([12]);
      expect(booking.defaultRentalMonths).toBe(12);
    });

    it('falls back to the minimum term when no option is in range', async () => {
      serve({ 'booking.min_rental_months': 24, 'booking.default_rental_months': 6 });

      const { booking } = await service.getClientSettings();

      expect(booking.rentalMonthsOptions).toEqual([24]);
      expect(booking.defaultRentalMonths).toBe(24);
    });
  });

  describe('getDepositMonthsFor', () => {
    it('uses the unit own level when set', async () => {
      await expect(service.getDepositMonthsFor({ depositMonths: 3 })).resolves.toBe(3);
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('falls back to deposit.default_months when the unit has none', async () => {
      repo.findOne.mockResolvedValue(buildSetting('deposit.default_months', 1.5));

      await expect(service.getDepositMonthsFor({ depositMonths: null })).resolves.toBe(1.5);
    });
  });
});
