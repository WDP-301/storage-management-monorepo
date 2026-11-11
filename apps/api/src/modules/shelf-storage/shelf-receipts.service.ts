import { findOverdueInvoiceNos } from '@modules/access/overdue-invoices.query';
import { assertWorksAtFacility } from '@modules/access/staff-facility.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import {
  ContractStatus,
  type CreateShelfReceiptInput,
  ShelfReceiptType,
  type ShelfReceiptView,
} from '@storage/types';
import { DataSource, type EntityManager } from 'typeorm';
import { assertLiveSession } from './counter-session.util';
import { validateReceiptShape } from './receipt-input.util';
import { applyDropOff, applyPickUp } from './receipt-stock.util';
import { findReplay, insertReceipt, withReceiptCodeRetry } from './receipt-writer.util';
import { findShelfContracts, loadStock, type ShelfContractRow } from './shelf-contract.query';
import { cancelOpenPickupRequestsIfEmptied } from './shelf-empty-guard.util';
import { receiptNotice } from './shelf-notifications';
import { loadReceipts } from './shelf-receipt.read';
import { dropOffBlock, pickUpBlock } from './shelf-rules';

const notAllowed = (reason: string, message: string, details: Record<string, unknown> = {}) =>
  new DomainException(ErrorCode.SHELF_RECEIPT_NOT_ALLOWED, message, HttpStatus.CONFLICT, {
    reason,
    ...details,
  });

const invoiceOverdue = (invoiceNos: string[]) =>
  new DomainException(
    ErrorCode.INVOICE_OVERDUE,
    'Khách còn hóa đơn quá hạn — cần thanh toán trước khi gửi / lấy đồ',
    HttpStatus.CONFLICT,
    { invoiceNos },
  );

@Injectable()
export class ShelfReceiptsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Records a drop-off or pick-up inside a live counter session. Everything happens in one
   * transaction under the lock order contract → pick-up request → items, so concurrent receipts,
   * voids and a return finalize cannot interleave. A replayed `clientRequestId` returns the saved
   * receipt without touching stock.
   */
  async create(actor: AuthUser, input: CreateShelfReceiptInput): Promise<ShelfReceiptView> {
    const lines = validateReceiptShape(input, actor.id);
    return withReceiptCodeRetry(this.dataSource, async (em) => {
      const [contract] = await findShelfContracts(em, { contractId: input.contractId, lock: true });
      if (!contract) notFound('Contract', input.contractId);
      await assertWorksAtFacility(em, actor, contract.facility.id);

      const replay = await findReplay(em, input.clientRequestId, contract.id);
      if (replay) return replay;

      const session = await assertLiveSession(em, actor, input.sessionId, contract);
      if (contract.status !== ContractStatus.ACTIVE) {
        throw notAllowed('CONTRACT_NOT_ACTIVE', 'Hợp đồng không còn hiệu lực');
      }
      const now = new Date();
      const invoiceNos = await findOverdueInvoiceNos(em, contract.customerId, now);
      const overdue = invoiceNos.length > 0;

      if (input.type === ShelfReceiptType.DROP_OFF) {
        const block = dropOffBlock(contract, overdue, now);
        if (block === 'CONTRACT_NOT_STARTED') {
          throw notAllowed('CONTRACT_NOT_STARTED', 'Hợp đồng chưa đến ngày bắt đầu', {
            effectiveAt: contract.effectiveAt,
          });
        }
        if (block === 'INVOICE_OVERDUE') throw invoiceOverdue(invoiceNos);
      }

      if (input.pickupRequestId) await this.lockOpenRequest(em, input.pickupRequestId, contract);
      if (input.dropOffRequestId) {
        await this.lockOpenDropOffRequest(em, input.dropOffRequestId, contract);
      }
      const stock =
        (await loadStock(em, [contract.id], { lock: true, includeEmpty: true })).get(contract.id) ??
        [];

      let applied: Awaited<ReturnType<typeof applyDropOff>>;
      if (input.type === ShelfReceiptType.DROP_OFF) {
        applied = await applyDropOff(em, contract.id, lines, stock);
      } else {
        const total = stock.reduce((sum, item) => sum + item.quantity, 0);
        // NO_STOCK is left to the shortage check, which names the items.
        if (pickUpBlock(total, overdue, contract.returnOpen) === 'INVOICE_OVERDUE') {
          throw invoiceOverdue(invoiceNos);
        }
        applied = await applyPickUp(em, lines, stock);
      }

      const id = await insertReceipt(em, {
        type: input.type,
        contract,
        sessionId: session.id,
        clientRequestId: input.clientRequestId,
        performedBy: actor.id,
        note: input.note?.trim() || null,
        photos: input.photos ?? [],
        pickupRequestId: input.pickupRequestId ?? null,
        dropOffRequestId: input.dropOffRequestId ?? null,
        lines: applied,
      });
      if (input.pickupRequestId) {
        await em.query(
          `UPDATE "pickup_requests" SET "status" = 'COMPLETED', "completed_at" = now(), "updated_at" = now()
            WHERE "id" = $1`,
          [input.pickupRequestId],
        );
      }
      if (input.dropOffRequestId) {
        await em.query(
          `UPDATE "drop_off_requests" SET "status" = 'COMPLETED', "completed_at" = now(), "updated_at" = now()
            WHERE "id" = $1`,
          [input.dropOffRequestId],
        );
      }
      if (input.type === ShelfReceiptType.PICK_UP) {
        await cancelOpenPickupRequestsIfEmptied(em, contract.id, stock, applied);
      }
      const [receipt] = (await loadReceipts(em, { ids: [id] })).receipts;
      await this.notifications.createForUsers(em, [contract.customerId], receiptNotice(receipt));
      return receipt;
    });
  }

  /** Locks the request being completed; it must be this contract's, still open. */
  private async lockOpenRequest(
    em: EntityManager,
    requestId: string,
    contract: ShelfContractRow,
  ): Promise<void> {
    const [request]: { contractId: string; status: string }[] = await em.query(
      `SELECT "contract_id" AS "contractId", "status" FROM "pickup_requests" WHERE "id" = $1 FOR UPDATE`,
      [requestId],
    );
    if (
      !request ||
      request.contractId !== contract.id ||
      (request.status !== 'PENDING' && request.status !== 'READY')
    ) {
      throw notAllowed(
        'PICKUP_REQUEST_MISMATCH',
        'Yêu cầu lấy đồ không còn mở hoặc không thuộc hợp đồng này',
      );
    }
  }

  /** Locks the drop-off request being completed; it must be this contract's, still open. */
  private async lockOpenDropOffRequest(
    em: EntityManager,
    requestId: string,
    contract: ShelfContractRow,
  ): Promise<void> {
    const [request]: { contractId: string; status: string }[] = await em.query(
      `SELECT "contract_id" AS "contractId", "status" FROM "drop_off_requests" WHERE "id" = $1 FOR UPDATE`,
      [requestId],
    );
    if (
      !request ||
      request.contractId !== contract.id ||
      (request.status !== 'PENDING' && request.status !== 'CONFIRMED')
    ) {
      throw notAllowed(
        'DROP_OFF_REQUEST_MISMATCH',
        'Yêu cầu gửi đồ không còn mở hoặc không thuộc hợp đồng này',
      );
    }
  }
}
