import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { TourAppointment } from '@entities/tour-appointment.entity';
import { HttpStatus } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { TourAppointmentStatus } from '@storage/types';
import { type EntityManager, In, IsNull } from 'typeorm';
import type { UpdateWarehouseDto } from './dto/warehouse.dto';

/** Tour appointments that still expect someone at the warehouse. */
const OPEN_TOUR_STATUSES = [
  TourAppointmentStatus.PENDING,
  TourAppointmentStatus.CONFIRMED,
  TourAppointmentStatus.ASSIGNED,
];

/** Physical identity of a warehouse — frozen while a customer is attached. */
export const FROZEN_WHEN_OCCUPIED = [
  'code',
  'widthM',
  'lengthM',
  'heightM',
  'status',
  'facilityId',
] as const;

export type FrozenField = (typeof FROZEN_WHEN_OCCUPIED)[number];

/** Shared lock: the facility must exist and cannot be deleted while a warehouse is written under it. */
export async function lockFacility(manager: EntityManager, id: string): Promise<Facility> {
  const facility = await manager.findOne(Facility, {
    where: { id },
    lock: { mode: 'pessimistic_read' },
  });
  if (!facility) {
    throw new DomainException(
      ErrorCode.BAD_REQUEST,
      'Facility does not exist',
      HttpStatus.BAD_REQUEST,
    );
  }
  return facility;
}

export async function lockUnit(manager: EntityManager, id: string): Promise<StorageUnit> {
  const unit = await manager.findOne(StorageUnit, {
    where: { id, deletedAt: IsNull() },
    lock: { mode: 'pessimistic_write' },
  });
  if (!unit) notFound('Warehouse', id);
  return unit;
}

export const countOpenTours = (manager: EntityManager, storageUnitId: string): Promise<number> =>
  manager.count(TourAppointment, {
    where: { storageUnitId, status: In(OPEN_TOUR_STATUSES) },
  });

export async function assertNoOpenTours(
  manager: EntityManager,
  storageUnitId: string,
): Promise<void> {
  const openTours = await countOpenTours(manager, storageUnitId);
  if (openTours > 0) {
    throw new DomainException(
      ErrorCode.CONFLICT,
      'Cannot move a warehouse that still has open tour appointments',
      HttpStatus.CONFLICT,
      { openTours },
    );
  }
}

export function changes(dto: UpdateWarehouseDto, field: FrozenField, unit: StorageUnit): boolean {
  const next = dto[field];
  if (next === undefined) return false;
  if (field === 'code' || field === 'status' || field === 'facilityId') return next !== unit[field];
  // decimal columns come back from pg as strings
  const current = unit[field];
  return current === null ? next !== null : Number(next) !== Number(current);
}
