import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import type { EntityManager } from 'typeorm';

/**
 * Reads a numeric setting on the caller's transaction, for helpers that only hold an
 * EntityManager (invoice issuers run deep inside other modules' transactions). Services with
 * `SettingsService` injected should use its typed, cached getters instead.
 */
export async function readNumberSetting(em: EntityManager, key: string): Promise<number> {
  const [row]: { value: unknown }[] = await em.query(
    `SELECT "value" FROM "system_settings" WHERE "key" = $1`,
    [key],
  );
  if (!row) {
    throw new DomainException(
      ErrorCode.INTERNAL_ERROR,
      `System setting '${key}' is not defined`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
  return typeof row.value === 'number' ? row.value : Number(row.value);
}
