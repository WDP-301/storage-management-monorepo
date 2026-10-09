import { StorageUnitStatus } from '@storage/types';

/**
 * Statuses with no customer attached (no hold, booking, contract or pending move-out
 * inspection). Only idle units may be deleted or have their identity/pricing changed.
 */
export const IDLE_UNIT_STATUSES: readonly StorageUnitStatus[] = [
  StorageUnitStatus.AVAILABLE,
  StorageUnitStatus.MAINTENANCE,
  StorageUnitStatus.INACTIVE,
];

export function isIdleUnitStatus(status: StorageUnitStatus): boolean {
  return IDLE_UNIT_STATUSES.includes(status);
}
