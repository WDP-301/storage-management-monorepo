import type { SystemSetting } from '@entities/system-setting.entity';
import type { SettingValueType } from '@storage/types';
import { validateSettingValue } from './setting-value.validator';

const row = (valueType: SettingValueType, min?: number, max?: number): SystemSetting =>
  ({ valueType, min, max }) as SystemSetting;

describe('validateSettingValue', () => {
  describe('int', () => {
    it.each([0, 30, 180, -5])('accepts the integer %d when unbounded', (value) => {
      expect(validateSettingValue(row('int'), value)).toBeNull();
    });

    it.each([1.5, '30', null, undefined, true, Number.NaN])('rejects %p', (value) => {
      expect(validateSettingValue(row('int'), value)).toBe('Value must be an integer');
    });

    it('enforces inclusive bounds', () => {
      const bounded = row('int', 0, 180);

      expect(validateSettingValue(bounded, 0)).toBeNull();
      expect(validateSettingValue(bounded, 180)).toBeNull();
      expect(validateSettingValue(bounded, -1)).toBe('Value must be >= 0');
      expect(validateSettingValue(bounded, 181)).toBe('Value must be <= 180');
    });

    it('treats a zero bound as a bound, not as missing', () => {
      expect(validateSettingValue(row('int', 0), -1)).toBe('Value must be >= 0');
    });
  });

  describe('float', () => {
    it('accepts finite numbers within bounds', () => {
      expect(validateSettingValue(row('float', 0.5, 1.5), 1.25)).toBeNull();
      expect(validateSettingValue(row('float', 0.5, 1.5), 0.4)).toBe('Value must be >= 0.5');
      expect(validateSettingValue(row('float', 0.5, 1.5), 1.6)).toBe('Value must be <= 1.5');
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, '1.5', null])('rejects %p', (value) => {
      expect(validateSettingValue(row('float'), value)).toBe('Value must be a number');
    });
  });

  describe('string', () => {
    it('accepts any string, including the empty one, and ignores numeric bounds', () => {
      expect(validateSettingValue(row('string', 5, 10), '')).toBeNull();
      expect(validateSettingValue(row('string', 5, 10), 'a very long string value')).toBeNull();
    });

    it.each([5, null, ['a']])('rejects %p', (value) => {
      expect(validateSettingValue(row('string'), value)).toBe('Value must be a string');
    });
  });

  describe('boolean', () => {
    it('accepts true and false', () => {
      expect(validateSettingValue(row('boolean'), true)).toBeNull();
      expect(validateSettingValue(row('boolean'), false)).toBeNull();
    });

    it.each(['true', 1, 0, null])('rejects %p', (value) => {
      expect(validateSettingValue(row('boolean'), value)).toBe('Value must be a boolean');
    });
  });

  describe('duration_minutes', () => {
    it('accepts positive integers within bounds', () => {
      expect(validateSettingValue(row('duration_minutes', 1, 60), 15)).toBeNull();
      expect(validateSettingValue(row('duration_minutes', 1, 60), 60)).toBeNull();
      expect(validateSettingValue(row('duration_minutes', 1, 60), 61)).toBe('Value must be <= 60');
    });

    it.each([0, -1, 1.5, '15', null])('rejects %p', (value) => {
      expect(validateSettingValue(row('duration_minutes'), value)).toBe(
        'Value must be a positive integer number of minutes',
      );
    });
  });

  describe('int_list', () => {
    it('accepts an empty list and lists within bounds', () => {
      expect(validateSettingValue(row('int_list', 1, 60), [])).toBeNull();
      expect(validateSettingValue(row('int_list', 1, 60), [1, 12, 60])).toBeNull();
    });

    it.each(['6,12', [1.5], ['6'], [6, null], null, 6])('rejects %p', (value) => {
      expect(validateSettingValue(row('int_list'), value)).toBe(
        'Value must be an array of integers',
      );
    });

    it('checks every item against the bounds', () => {
      expect(validateSettingValue(row('int_list', 1, 60), [6, 0])).toBe('Each item must be >= 1');
      expect(validateSettingValue(row('int_list', 1, 60), [6, 61])).toBe('Each item must be <= 60');
    });

    it('applies no bound when none is stored', () => {
      expect(validateSettingValue(row('int_list'), [-100, 100])).toBeNull();
    });
  });
});
