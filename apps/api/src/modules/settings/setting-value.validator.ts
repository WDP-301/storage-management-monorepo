import type { SystemSetting } from '@entities/system-setting.entity';

/**
 * Validates a candidate value against the row's declared type and bounds.
 * Returns an error message, or `null` when the value is valid.
 */
export function validateSettingValue(row: SystemSetting, value: unknown): string | null {
  const { min, max } = row;

  switch (row.valueType) {
    case 'int':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return 'Value must be an integer';
      }
      break;
    case 'float':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 'Value must be a number';
      }
      break;
    case 'string':
      if (typeof value !== 'string') {
        return 'Value must be a string';
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        return 'Value must be a boolean';
      }
      break;
    case 'duration_minutes':
      if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
        return 'Value must be a positive integer number of minutes';
      }
      break;
    case 'int_list':
      if (
        !Array.isArray(value) ||
        !value.every((v) => typeof v === 'number' && Number.isInteger(v))
      ) {
        return 'Value must be an array of integers';
      }
      if (min != null && value.some((v) => v < min)) {
        return `Each item must be >= ${min}`;
      }
      if (max != null && value.some((v) => v > max)) {
        return `Each item must be <= ${max}`;
      }
      break;
  }

  if (row.valueType !== 'string' && row.valueType !== 'boolean' && row.valueType !== 'int_list') {
    const numeric = value as number;
    if (min != null && numeric < min) {
      return `Value must be >= ${min}`;
    }
    if (max != null && numeric > max) {
      return `Value must be <= ${max}`;
    }
  }

  return null;
}
