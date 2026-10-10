import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitHold } from '@entities/unit-hold.entity';
import { HttpStatus } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { ContractStatus, HoldStatus } from '@storage/types';
import { type EntityManager, In, IsNull, Not } from 'typeorm';

const LIVE_CONTRACT_STATUSES = [ContractStatus.DRAFT, ContractStatus.ACTIVE];

/**
 * Locks the item's unit and refuses when another booking claims it — an ACTIVE hold of
 * another booking, or a DRAFT/ACTIVE contract on another booking item. Unit status alone
 * cannot tell whose BOOKED/HELD it is, so without this a stale booking could take a unit
 * someone else is holding or has already paid for. Returns the locked unit.
 */
export async function lockUnitClaimedOnlyBy(
  em: EntityManager,
  item: BookingItem,
): Promise<StorageUnit> {
  const unit = await em.findOne(StorageUnit, {
    where: { id: item.storageUnitId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!unit) notFound('Storage unit', item.storageUnitId);

  // Holds count until the sweep releases them: a late deposit can still confirm one.
  const otherHold = await em.findOne(UnitHold, {
    where: {
      storageUnitId: unit.id,
      status: HoldStatus.ACTIVE,
      bookingId: Not(item.bookingId),
    },
  });
  const otherContract = await em.findOne(Contract, {
    where: {
      bookingItem: { storageUnitId: unit.id },
      bookingItemId: Not(item.id),
      status: In(LIVE_CONTRACT_STATUSES),
      deletedAt: IsNull(),
    },
  });
  if (otherHold || otherContract) {
    throw new DomainException(
      ErrorCode.UNIT_NOT_AVAILABLE,
      'The storage unit is held or contracted by another booking',
      HttpStatus.CONFLICT,
      {
        storageUnitId: unit.id,
        heldByBookingId: otherHold?.bookingId ?? null,
        contractId: otherContract?.id ?? null,
      },
    );
  }
  return unit;
}
