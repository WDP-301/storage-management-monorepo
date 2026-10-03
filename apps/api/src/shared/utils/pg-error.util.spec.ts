import { isUniqueViolation, pgErrorCode } from './pg-error.util';

describe('pg-error.util', () => {
  it('reads a code set directly on the error', () => {
    expect(pgErrorCode({ code: '23505' })).toBe('23505');
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('reads a code nested under driverError', () => {
    expect(pgErrorCode({ driverError: { code: '23505' } })).toBe('23505');
    expect(isUniqueViolation({ driverError: { code: '23505' } })).toBe(true);
  });

  it('returns undefined for non-pg and non-object errors', () => {
    expect(pgErrorCode('23505')).toBeUndefined();
    expect(pgErrorCode(null)).toBeUndefined();
    expect(pgErrorCode({ code: 23505 })).toBeUndefined();
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
  });
});
