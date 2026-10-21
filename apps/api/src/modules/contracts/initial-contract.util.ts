import { randomUUID } from 'node:crypto';
import { AppUser } from '@entities/app-user.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { snapshotUnitAmenities } from '@modules/amenities/contract-amenities';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { isUniqueViolation } from '@shared/utils/pg-error.util';
import { ContractKind, ContractStatus, InspectionType } from '@storage/types';
import Decimal from 'decimal.js';
import { EntityManager } from 'typeorm';
import { captureDepositSafely } from './deposit-ledger.util';

export interface PersistContractInput {
  item: BookingItem;
  customer: AppUser;
  effectiveAt: Date;
  kind?: ContractKind;
  status?: ContractStatus;
  endedAt?: Date;
  signedAt?: Date;
  termsSnapshot?: Record<string, unknown>;
  /**
   * Freeze the warehouse's current amenities into the contract (default true). Pass false when
   * the contract describes a past rental, where today's amenities would be a guess.
   */
  snapshotAmenities?: boolean;
}

/**
 * Saves a contract for a booking item plus its empty PRE_HANDOVER inspection, then records its
 * deposit in the ledger. Plain function over an EntityManager so the caller's transaction covers
 * the rows (inspection failure rolls back the contract) and BookingsModule can use it without
 * depending on ContractsModule. The deposit is recorded inside a savepoint that never fails the
 * caller, so a ledger problem cannot undo a confirmed deposit transfer.
 */
export async function persistContract(
  manager: EntityManager,
  input: PersistContractInput,
): Promise<Contract> {
  const { item, customer } = input;
  // Each item already stores MONTHLY rent — snapshot it directly rather than deriving
  // from the booking subtotal (which may include other units and rental terms).
  const monthlyPriceSnapshot = new Decimal(item.monthlyPriceSnapshot).toFixed(2);
  const amenitiesSnapshot =
    input.snapshotAmenities === false
      ? null
      : await snapshotUnitAmenities(manager, item.storageUnitId);
  const contract = manager.create(Contract, {
    amenitiesSnapshot,
    contractNo: `CT-${randomUUID()}`,
    bookingItemId: item.id,
    customerId: customer.id,
    kind: input.kind ?? ContractKind.INITIAL,
    status: input.status ?? ContractStatus.DRAFT,
    effectiveAt: input.effectiveAt,
    endedAt: input.endedAt,
    signedAt: input.signedAt,
    months: item.rentalMonths,
    monthlyPriceSnapshot: monthlyPriceSnapshot as unknown as number,
    termsSnapshot: input.termsSnapshot ?? {},
    customerSnapshot: {
      id: customer.id,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone ?? null,
    },
  });

  let saved: Contract;
  try {
    saved = await manager.save(Contract, contract);
  } catch (err) {
    // UQ_contract_initial_item — a second INITIAL contract for the same item.
    if (isUniqueViolation(err)) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        'An initial contract already exists for this booking item',
        HttpStatus.CONFLICT,
        { bookingItemId: item.id },
      );
    }
    throw err;
  }

  // Other fields use entity/DB defaults (evidence/damages=[],
  // inspectedBy/conditionNotes/inspectedAt/finalizedAt=NULL).
  await manager.save(
    Inspection,
    manager.create(Inspection, {
      contractId: saved.id,
      type: InspectionType.PRE_HANDOVER,
      scheduledAt: saved.effectiveAt,
    }),
  );
  await captureDepositSafely(manager, saved);
  return saved;
}
