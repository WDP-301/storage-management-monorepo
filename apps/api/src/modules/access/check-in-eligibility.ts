import type { Contract } from '@entities/contract.entity';
import type { StorageUnit } from '@entities/storage-unit.entity';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { startOfVietnamDay } from '@shared/utils/calendar.util';
import { ContractStatus, StorageUnitKind } from '@storage/types';
import type { EntityManager } from 'typeorm';
import { findOverdueInvoiceNos } from './overdue-invoices.query';

export const QR_PREFIX = 'SMCI1:';
// 32 random bytes in base64url (no padding) are exactly 43 characters.
const PAYLOAD_PATTERN = /^SMCI1:([A-Za-z0-9_-]{43})$/;

export const buildPayload = (token: string): string => `${QR_PREFIX}${token}`;

// Kept importable from here for existing callers; the Vietnam calendar lives in calendar.util.
export { startOfVietnamDay };

/**
 * Extracts the token from a scanned payload, or null when it is not one of ours. Surrounding
 * whitespace is dropped: keyboard-wedge scanners often append a newline.
 */
export function parsePayload(payload: string): string | null {
  return PAYLOAD_PATTERN.exec(payload.trim())?.[1] ?? null;
}

export type CheckInRefusalReason = 'CONTRACT_NOT_ACTIVE' | 'CONTRACT_NOT_STARTED' | 'NOT_SHELF';

export interface CheckInRefusal {
  reason: CheckInRefusalReason;
  effectiveAt?: Date;
}

/**
 * Why a contract cannot be used to enter right now, or null when it can. A contract past
 * `endedAt` stays allowed while ACTIVE: the goods are still on the shelf until the return
 * inspection, and unpaid renewals are blocked by the overdue-invoice rule instead.
 */
export function checkInRefusal(
  contract: Pick<Contract, 'status' | 'effectiveAt'>,
  unit: Pick<StorageUnit, 'kind'>,
  now: Date,
): CheckInRefusal | null {
  if (unit.kind !== StorageUnitKind.SHELF) return { reason: 'NOT_SHELF' };
  if (contract.status !== ContractStatus.ACTIVE) return { reason: 'CONTRACT_NOT_ACTIVE' };
  // The handover can be signed before the agreed start date; entry opens at 00:00 Vietnam time
  // on that date, whatever hour the contract itself starts.
  if (startOfVietnamDay(contract.effectiveAt).getTime() > now.getTime()) {
    return { reason: 'CONTRACT_NOT_STARTED', effectiveAt: contract.effectiveAt };
  }
  return null;
}

/** Throws CHECK_IN_NOT_ALLOWED or INVOICE_OVERDUE (both 409); shared by pass generation and scan. */
export async function assertCheckInAllowed(
  em: EntityManager,
  contract: Pick<Contract, 'status' | 'effectiveAt' | 'customerId'>,
  unit: Pick<StorageUnit, 'kind'>,
  now: Date,
): Promise<void> {
  const refusal = checkInRefusal(contract, unit, now);
  if (refusal) {
    throw new DomainException(
      ErrorCode.CHECK_IN_NOT_ALLOWED,
      'This contract cannot be used to check in',
      HttpStatus.CONFLICT,
      {
        reason: refusal.reason,
        ...(refusal.effectiveAt ? { effectiveAt: refusal.effectiveAt } : {}),
      },
    );
  }
  const invoiceNos = await findOverdueInvoiceNos(em, contract.customerId, now);
  if (invoiceNos.length > 0) {
    throw new DomainException(
      ErrorCode.INVOICE_OVERDUE,
      'Settle the overdue invoices before checking in',
      HttpStatus.CONFLICT,
      { invoiceNos },
    );
  }
}
