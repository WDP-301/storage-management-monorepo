import { HttpStatus } from '@nestjs/common';
import {
  DomainException,
  fieldValidationError,
  notFound,
} from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { ShelfReceiptStatus, TicketStatus } from '@storage/types';
import type { EntityManager } from 'typeorm';

/** Statuses in which a ticket is still being worked on. */
export const OPEN_TICKET_STATUSES: readonly TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
];

export interface TicketReceiptLink {
  receiptId: string;
  storageUnitId: string;
}

interface ReceiptRow {
  id: string;
  customer_id: string;
  facility_id: string;
  storage_unit_id: string;
  status: ShelfReceiptStatus;
}

/**
 * Checks a customer's report of a wrong receipt and returns what the ticket must store.
 * The receipt of another customer reads as unknown (404) so ids reveal nothing. The shelf comes
 * from the receipt, never from the request.
 *
 * With `lock`, the receipt row is locked until the surrounding transaction ends: a concurrent
 * void or second report then waits, and the checks below see its committed outcome.
 */
export async function resolveReceiptLink(
  em: EntityManager,
  customerId: string,
  dto: { shelfReceiptId?: string; storageUnitId?: string; facilityId: string },
  options: { lock?: boolean } = {},
): Promise<TicketReceiptLink | null> {
  if (!dto.shelfReceiptId) return null;

  const [receipt]: ReceiptRow[] = await em.query(
    `SELECT "id", "customer_id", "facility_id", "storage_unit_id", "status"
       FROM "shelf_receipts" WHERE "id" = $1${options.lock ? ' FOR UPDATE' : ''}`,
    [dto.shelfReceiptId],
  );
  if (!receipt || receipt.customer_id !== customerId) notFound('Receipt', dto.shelfReceiptId);

  if (dto.storageUnitId) {
    throw fieldValidationError(
      'storageUnitId',
      'notAllowed',
      'The storage unit comes from the receipt',
    );
  }
  if (dto.facilityId !== receipt.facility_id) {
    throw fieldValidationError(
      'facilityId',
      'notReceiptFacility',
      'Facility must be the one the receipt was issued at',
    );
  }
  if (receipt.status === ShelfReceiptStatus.VOIDED) {
    throw new DomainException(
      ErrorCode.CONFLICT,
      'Receipt is already voided',
      HttpStatus.CONFLICT,
      { reason: 'RECEIPT_VOIDED' },
    );
  }

  const [open]: { id: string; ticket_no: string }[] = await em.query(
    `SELECT "id", "ticket_no" FROM "service_tickets"
      WHERE "shelf_receipt_id" = $1 AND "status" = ANY($2::text[])
      ORDER BY "created_at" DESC LIMIT 1`,
    [receipt.id, OPEN_TICKET_STATUSES],
  );
  if (open) {
    throw new DomainException(
      ErrorCode.CONFLICT,
      'This receipt already has an open report',
      HttpStatus.CONFLICT,
      { reason: 'OPEN_DISPUTE_EXISTS', ticketId: open.id, ticketNo: open.ticket_no },
    );
  }
  return { receiptId: receipt.id, storageUnitId: receipt.storage_unit_id };
}
