import { StorageUnitKind } from '@storage/types';

/**
 * Kinds a customer can book or rent. A shelf warehouse is only a container for its shelves,
 * so it never takes a hold, booking or contract itself.
 */
export const RENTABLE_KINDS: readonly StorageUnitKind[] = [
  StorageUnitKind.SELF_STORAGE,
  StorageUnitKind.SHELF,
];

export function isRentableKind(kind: StorageUnitKind): boolean {
  return RENTABLE_KINDS.includes(kind);
}
