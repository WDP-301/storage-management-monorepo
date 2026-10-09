/** PostgreSQL SQLSTATE for unique-constraint violations. */
export const PG_UNIQUE_VIOLATION = '23505';
/** PostgreSQL SQLSTATE for foreign-key violations. */
export const PG_FK_VIOLATION = '23503';
/** PostgreSQL SQLSTATE for check-constraint violations. */
export const PG_CHECK_VIOLATION = '23514';
/** PostgreSQL SQLSTATE for a value out of range for its numeric column. */
export const PG_NUMERIC_OVERFLOW = '22003';

/**
 * Extracts the Postgres SQLSTATE from a thrown error. Driver errors surface `code`
 * directly; TypeORM's QueryFailedError exposes it either on itself or nested under
 * `driverError`, so both are checked.
 */
export function pgErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { code, driverError } = error as { code?: unknown; driverError?: { code?: unknown } };
  const resolved = typeof code === 'string' ? code : driverError?.code;
  return typeof resolved === 'string' ? resolved : undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === PG_UNIQUE_VIOLATION;
}
