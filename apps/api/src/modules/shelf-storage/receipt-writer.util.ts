import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { isUniqueViolation } from '@shared/utils/pg-error.util';
import type { EvidenceFile, ShelfReceiptType, ShelfReceiptView } from '@storage/types';
import type { DataSource, EntityManager } from 'typeorm';
import type { AppliedLine } from './receipt-stock.util';
import type { ShelfContractRow } from './shelf-contract.query';
import { loadReceipts } from './shelf-receipt.read';
import { receiptCode } from './shelf-rules';

const MAX_ATTEMPTS = 3;

/**
 * Runs a receipt write in its own transaction, again in a fresh one when a unique index is hit.
 * Codes carry only 8 random hex digits per day, so a collision is possible; the retry draws a new
 * code. A concurrent save of one `clientRequestId` also lands here: the retry then finds the
 * receipt and replays it. Anything else is rethrown.
 */
export async function withReceiptCodeRetry<T>(
  dataSource: DataSource,
  run: (em: EntityManager) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await dataSource.transaction(run);
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isUniqueViolation(error)) throw error;
    }
  }
}

/**
 * The receipt already saved for this `clientRequestId`, or null. Reusing the id on another
 * contract is a client bug, refused rather than answered with someone else's receipt. Call it
 * after the contract lock so duplicate saves of one form serialize.
 */
export async function findReplay(
  em: EntityManager,
  clientRequestId: string,
  contractId: string,
): Promise<ShelfReceiptView | null> {
  const [existing]: { id: string; contractId: string }[] = await em.query(
    `SELECT "id", "contract_id" AS "contractId" FROM "shelf_receipts" WHERE "client_request_id" = $1`,
    [clientRequestId],
  );
  if (!existing) return null;
  if (existing.contractId !== contractId) {
    throw new DomainException(
      ErrorCode.SHELF_RECEIPT_NOT_ALLOWED,
      'Mã yêu cầu đã được dùng cho hợp đồng khác',
      HttpStatus.CONFLICT,
      { reason: 'CLIENT_REQUEST_REUSED' },
    );
  }
  const { receipts } = await loadReceipts(em, { ids: [existing.id] });
  return receipts[0] ?? null;
}

export interface NewReceipt {
  type: ShelfReceiptType;
  contract: ShelfContractRow;
  /** Null only for a manager's recovery of an abandoned shelf. */
  sessionId: string | null;
  clientRequestId: string;
  performedBy: string;
  note: string | null;
  photos: EvidenceFile[];
  pickupRequestId: string | null;
  lines: AppliedLine[];
}

/** Inserts the receipt and its lines, snapshotting shelf, warehouse and facility; returns its id. */
export async function insertReceipt(em: EntityManager, input: NewReceipt): Promise<string> {
  const { contract } = input;
  const [row]: { id: string }[] = await em.query(
    `INSERT INTO "shelf_receipts"
       ("code", "type", "contract_id", "customer_id", "storage_unit_id", "warehouse_id", "facility_id",
        "session_id", "client_request_id", "performed_by", "note", "photos", "pickup_request_id")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
     RETURNING "id"`,
    [
      receiptCode(input.type, new Date()),
      input.type,
      contract.id,
      contract.customerId,
      contract.shelf.id,
      contract.warehouse.id,
      contract.facility.id,
      input.sessionId,
      input.clientRequestId,
      input.performedBy,
      input.note,
      JSON.stringify(input.photos),
      input.pickupRequestId,
    ],
  );
  await em.query(
    `INSERT INTO "shelf_receipt_lines" ("receipt_id", "item_id", "name", "quantity")
     SELECT $1, t.* FROM unnest($2::uuid[], $3::text[], $4::int[]) AS t`,
    [
      row.id,
      input.lines.map((line) => line.itemId),
      input.lines.map((line) => line.name),
      input.lines.map((line) => line.quantity),
    ],
  );
  return row.id;
}
