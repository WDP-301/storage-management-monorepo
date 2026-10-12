import { StorageUnit } from '@entities/storage-unit.entity';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import type { EntityManager } from 'typeorm';
import type { UpdateWarehouseDto } from './dto/warehouse.dto';
import { isIdleUnitStatus } from './unit-status';
import { pick } from './warehouse-command.helpers';
import { assertNoOpenTickets, assertNoOpenTours, countOpenTours } from './warehouse-command.locks';

/** Where a shelf is lives on its shelf warehouse; shelves keep a copy so unit-level queries need no join. */
export const LOCATION_FIELDS = [
  'facilityId',
  'addressLine',
  'wardCode',
  'provinceCode',
  'latitude',
  'longitude',
] as const;

/** A shelf cannot move or be re-photographed on its own: location and photos belong to the parent. */
const SHELF_READONLY_FIELDS = [...LOCATION_FIELDS, 'images'] as const;

/** Shelf warehouses are priced per shelf, so these have no meaning on the building. */
const PARENT_FORBIDDEN_FIELDS = ['monthlyPrice', 'depositMonths'] as const;

const validationError = (fields: { field: string; code: string; message: string }[]) =>
  new DomainException(ErrorCode.VALIDATION_FAILED, 'Validation failed', HttpStatus.BAD_REQUEST, {
    fields,
  });

/** Refuses a rent or deposit on a shelf warehouse, on create and on update alike. */
export function assertNoParentPricing(dto: {
  monthlyPrice?: unknown;
  depositMonths?: unknown;
}): void {
  const fields = PARENT_FORBIDDEN_FIELDS.filter((field) => dto[field] !== undefined).map(
    (field) => ({
      field,
      code: 'isSetPerShelf',
      message: `${field} is set per shelf, not on the shelf warehouse`,
    }),
  );
  if (fields.length > 0) throw validationError(fields);
}

export function assertShelfPatchAllowed(dto: UpdateWarehouseDto): void {
  const fields = SHELF_READONLY_FIELDS.filter((field) => dto[field] !== undefined).map((field) => ({
    field,
    code: 'isInheritedFromParent',
    message: `${field} belongs to the shelf warehouse; edit it there`,
  }));
  if (fields.length > 0) throw validationError(fields);
}

/**
 * Shelf codes and names (and the short code shown in the mobile app) derive from the building's
 * code, so it is frozen once shelves exist. Price and deposit live on the shelves.
 */
export async function assertParentPatchAllowed(
  manager: EntityManager,
  dto: UpdateWarehouseDto,
  parent: StorageUnit,
): Promise<void> {
  assertNoParentPricing(dto);

  if (dto.code !== undefined && dto.code !== parent.code) {
    const shelves = await manager.count(StorageUnit, { where: { parentId: parent.id } });
    if (shelves > 0) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        'Cannot change the code of a shelf warehouse that has shelves',
        HttpStatus.CONFLICT,
        { fields: ['code'], shelves },
      );
    }
  }
}

/**
 * Locks every shelf (soft-deleted ones too — they are rewritten by the cascade) in id order.
 * A booking or tour holding a shelf has to finish first, so what is counted afterwards cannot
 * change before the surrounding transaction ends. Lock order: facility → parent → shelves.
 */
export const lockShelves = (manager: EntityManager, parentId: string): Promise<StorageUnit[]> =>
  manager.find(StorageUnit, {
    where: { parentId },
    withDeleted: true,
    order: { id: 'ASC' },
    lock: { mode: 'pessimistic_write' },
  });

const liveShelves = (shelves: StorageUnit[]) => shelves.filter((shelf) => !shelf.deletedAt);

function occupiedConflict(message: string, shelfIds: string[], openTours: number): DomainException {
  return new DomainException(ErrorCode.CONFLICT, message, HttpStatus.CONFLICT, {
    shelfIds,
    openTours,
  });
}

/**
 * Moving the building to another facility is refused while a customer is attached to any shelf
 * or anything is still scheduled on the building or its shelves.
 */
export async function assertParentMovable(
  manager: EntityManager,
  parent: StorageUnit,
): Promise<void> {
  const shelves = liveShelves(await lockShelves(manager, parent.id));
  const unitIds = [parent.id, ...shelves.map((shelf) => shelf.id)];
  const occupied = shelves.filter((shelf) => !isIdleUnitStatus(shelf.status));
  if (occupied.length > 0) {
    throw occupiedConflict(
      'Cannot move a shelf warehouse while its shelves are occupied',
      occupied.map((shelf) => shelf.id),
      await countOpenTours(manager, unitIds),
    );
  }
  await assertNoOpenTours(manager, unitIds);
  await assertNoOpenTickets(manager, unitIds);
}

/** Copies the building's new location onto every shelf in one statement, soft-deleted rows included. */
export async function cascadeParentLocation(
  manager: EntityManager,
  parentId: string,
  patch: Partial<StorageUnit>,
): Promise<void> {
  const location = pick(patch, LOCATION_FIELDS);
  if (Object.keys(location).length === 0) return;
  await manager.update(StorageUnit, { parentId }, location);
}

/** Retires the building and its shelves together; refused while any shelf is occupied or has a tour. */
export async function softDeleteWithShelves(
  manager: EntityManager,
  parent: StorageUnit,
): Promise<void> {
  const shelves = liveShelves(await lockShelves(manager, parent.id));
  const shelfIds = shelves.map((shelf) => shelf.id);
  const occupied = shelves.filter((shelf) => !isIdleUnitStatus(shelf.status));
  const openTours = await countOpenTours(manager, [parent.id, ...shelfIds]);
  if (occupied.length > 0 || openTours > 0) {
    throw occupiedConflict(
      'Shelf warehouse has occupied shelves or open tour appointments',
      occupied.map((shelf) => shelf.id),
      openTours,
    );
  }
  if (shelfIds.length > 0) await manager.softDelete(StorageUnit, shelfIds);
  await manager.softDelete(StorageUnit, parent.id);
}
