import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { UnitChangeRequest } from '@entities/unit-change-request.entity';
import { HttpStatus } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { addVietnamMonths, vietnamDate, vietnamToday } from '@shared/utils/calendar.util';
import { ContractStatus, InspectionType, OPEN_CHANGE_REQUEST_STATUSES } from '@storage/types';
import { type EntityManager, In, IsNull } from 'typeorm';

const conflict = (message: string, details?: Record<string, unknown>): DomainException =>
  new DomainException(ErrorCode.CONFLICT, message, HttpStatus.CONFLICT, details);

/** Where the term ends with `months` months from the start — the same instant return timing uses. */
export function termEndAt(contract: Pick<Contract, 'effectiveAt'>, months: number): Date {
  return addVietnamMonths(contract.effectiveAt, months);
}

/** The live contract, row-locked with its unit and facility, so a renewal decision is serialized. */
export async function lockContractForRenewal(
  em: EntityManager,
  contractId: string,
): Promise<Contract> {
  const locked = await em.findOne(Contract, {
    where: { id: contractId, deletedAt: IsNull() },
    lock: { mode: 'pessimistic_write' },
  });
  if (!locked) notFound('Contract', contractId);
  return em.findOneOrFail(Contract, {
    where: { id: contractId },
    relations: { bookingItem: { storageUnit: { facility: true } } },
  });
}

/**
 * A renewal extends a contract that is still running its course: ACTIVE, not leaving (no open
 * return) and not moving (no open unit change, whose destination keeps its own full term).
 */
export async function assertRenewable(em: EntityManager, contract: Contract): Promise<void> {
  if (contract.status !== ContractStatus.ACTIVE) {
    throw conflict('Chỉ gia hạn được hợp đồng đang hiệu lực', { status: contract.status });
  }
  const openReturn = await em.count(Inspection, {
    where: { contractId: contract.id, type: InspectionType.RETURN, finalizedAt: IsNull() },
  });
  if (openReturn > 0) {
    throw conflict('Hợp đồng đang có yêu cầu trả kho — hủy yêu cầu trả trước khi gia hạn');
  }
  const openChange = await em.count(UnitChangeRequest, {
    where: { contractId: contract.id, status: In([...OPEN_CHANGE_REQUEST_STATUSES]) },
  });
  if (openChange > 0) {
    throw conflict('Hợp đồng đang có yêu cầu đổi kho — không thể gia hạn lúc này');
  }
}

/** A request must reach the branch before the term ends; overstay is a penalty, never a renewal. */
export function assertBeforeTermEnd(contract: Contract, now: Date): void {
  const termEndDay = vietnamDate(termEndAt(contract, contract.months));
  if (vietnamToday(now) >= termEndDay) {
    throw conflict('Hợp đồng đã hết hạn — không thể gia hạn, hãy đặt lịch trả kho', {
      termEndDay,
    });
  }
}
