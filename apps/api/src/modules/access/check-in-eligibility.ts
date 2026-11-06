import { findShelfContracts } from '@modules/shelf-storage/shelf-contract.query';
import { dropOffBlock } from '@modules/shelf-storage/shelf-rules';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { ContractStatus } from '@storage/types';
import type { EntityManager } from 'typeorm';
import { findOverdueInvoiceNos } from './overdue-invoices.query';

export const QR_PREFIX = 'SMCI1:';
// 32 random bytes in base64url (no padding) are exactly 43 characters.
const PAYLOAD_PATTERN = /^SMCI1:([A-Za-z0-9_-]{43})$/;

export const buildPayload = (token: string): string => `${QR_PREFIX}${token}`;

/**
 * Extracts the token from a scanned payload, or null when it is not one of ours. Surrounding
 * whitespace is dropped: keyboard-wedge scanners often append a newline.
 */
export function parsePayload(payload: string): string | null {
  return PAYLOAD_PATTERN.exec(payload.trim())?.[1] ?? null;
}

export const refuseCheckIn = (reason: 'NO_SHELF_CONTRACT' | 'CONTRACT_NOT_STARTED', details = {}) =>
  new DomainException(
    ErrorCode.CHECK_IN_NOT_ALLOWED,
    'This customer cannot use the counter',
    HttpStatus.CONFLICT,
    { reason, ...details },
  );

/**
 * Throws CHECK_IN_NOT_ALLOWED or INVOICE_OVERDUE (both 409) unless the customer may be served at
 * a counter: an ACTIVE shelf contract that has started, and no overdue invoice — unless one of
 * the shelf contracts is being returned, because debt never keeps goods from a returning customer.
 * Checked when the pass is issued so the customer learns early; the counter re-evaluates per receipt.
 */
export async function assertCanIssuePass(
  em: EntityManager,
  customerId: string,
  now: Date,
): Promise<void> {
  const contracts = await findShelfContracts(em, {
    customerId,
    statuses: [ContractStatus.ACTIVE],
  });
  if (contracts.length === 0) throw refuseCheckIn('NO_SHELF_CONTRACT');

  // Start rule only (overdue = false): the debt rule is applied below across all contracts.
  const started = contracts.some((contract) => dropOffBlock(contract, false, now) === null);
  if (!started) {
    const effectiveAt = new Date(
      Math.min(...contracts.map((contract) => new Date(contract.effectiveAt).getTime())),
    );
    throw refuseCheckIn('CONTRACT_NOT_STARTED', { effectiveAt });
  }

  if (contracts.some((contract) => contract.returnOpen)) return;
  const invoiceNos = await findOverdueInvoiceNos(em, customerId, now);
  if (invoiceNos.length > 0) {
    throw new DomainException(
      ErrorCode.INVOICE_OVERDUE,
      'Settle the overdue invoices before using the counter',
      HttpStatus.CONFLICT,
      { invoiceNos },
    );
  }
}
