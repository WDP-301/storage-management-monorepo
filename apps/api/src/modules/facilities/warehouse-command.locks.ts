import { Facility } from '@entities/facility.entity';
import { ServiceTicket } from '@entities/service-ticket.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { TourAppointment } from '@entities/tour-appointment.entity';
import { HttpStatus } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { FacilityStatus, TicketStatus, TourAppointmentStatus } from '@storage/types';
import { type EntityManager, In, IsNull, Not } from 'typeorm';
import type { UpdateWarehouseDto } from './dto/warehouse.dto';
import { isIdleUnitStatus } from './unit-status';

/** Tour appointments that still expect someone at the warehouse. */
const OPEN_TOUR_STATUSES = [
  TourAppointmentStatus.PENDING,
  TourAppointmentStatus.CONFIRMED,
  TourAppointmentStatus.ASSIGNED,
];

/** Tickets in these states are finished; everything else still concerns the warehouse. */
const TERMINAL_TICKET_STATUSES = [
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
  TicketStatus.CANCELLED,
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

/** A warehouse can only be created in, or moved into, a facility that is open for business. */
export function assertFacilityActive(facility: Facility): void {
  if (facility.status !== FacilityStatus.ACTIVE) {
    throw new DomainException(
      ErrorCode.CONFLICT,
      'Facility is not active, cannot add or move a warehouse into it',
      HttpStatus.CONFLICT,
      { facilityStatus: facility.status, fields: ['facilityId'] },
    );
  }
}

export async function lockUnit(manager: EntityManager, id: string): Promise<StorageUnit> {
  const unit = await manager.findOne(StorageUnit, {
    where: { id, deletedAt: IsNull() },
    lock: { mode: 'pessimistic_write' },
  });
  if (!unit) notFound('Warehouse', id);
  return unit;
}

/** A shelf warehouse is checked together with its shelves, so callers may pass several unit ids. */
type UnitIds = string | string[];

const unitIdFilter = (ids: UnitIds) => (typeof ids === 'string' ? ids : In(ids));

export const countOpenTours = (manager: EntityManager, storageUnitId: UnitIds): Promise<number> =>
  manager.count(TourAppointment, {
    where: { storageUnitId: unitIdFilter(storageUnitId), status: In(OPEN_TOUR_STATUSES) },
  });

export async function assertNoOpenTours(
  manager: EntityManager,
  storageUnitId: UnitIds,
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

export async function assertNoOpenTickets(
  manager: EntityManager,
  storageUnitId: UnitIds,
): Promise<void> {
  const openTickets = await manager.count(ServiceTicket, {
    where: {
      storageUnitId: unitIdFilter(storageUnitId),
      status: Not(In(TERMINAL_TICKET_STATUSES)),
    },
  });
  if (openTickets > 0) {
    throw new DomainException(
      ErrorCode.CONFLICT,
      'Cannot move a warehouse that still has open service tickets',
      HttpStatus.CONFLICT,
      { openTickets },
    );
  }
}

/** An occupied warehouse keeps its physical identity: code, size, status and facility cannot change. */
export function assertNotFrozen(dto: UpdateWarehouseDto, unit: StorageUnit): void {
  if (isIdleUnitStatus(unit.status)) return;
  const frozen = FROZEN_WHEN_OCCUPIED.filter((field) => changes(dto, field, unit));
  if (frozen.length > 0) {
    throw new DomainException(
      ErrorCode.CONFLICT,
      `Cannot change ${frozen.join(', ')} of a ${unit.status} warehouse`,
      HttpStatus.CONFLICT,
      { status: unit.status, fields: [...frozen] },
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
