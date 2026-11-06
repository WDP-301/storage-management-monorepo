import type { AuthUser } from '@modules/auth/types/auth-user';
import { managesFacility } from '@modules/inspection/inspection-access.util';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { ContractStatus, type ShelfReceiptType, type ShelfReceiptView } from '@storage/types';
import { DataSource } from 'typeorm';
import { reverseReceiptStock } from './receipt-stock.util';
import { findShelfContracts, loadStock } from './shelf-contract.query';
import { voidedNotice } from './shelf-notifications';
import { loadReceipts } from './shelf-receipt.read';

interface ReceiptHead {
  contractId: string;
  facilityId: string;
  type: ShelfReceiptType;
  status: string;
}

@Injectable()
export class ReceiptVoidService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Cancels a saved receipt and reverses its stock, under the same lock order as saving one
   * (contract, then receipt, then items). Refused when the goods of a voided drop-off have since
   * been taken, so stock never goes below 0. The receipt stays visible, marked VOIDED.
   */
  async void(actor: AuthUser, receiptId: string, reason: string): Promise<ShelfReceiptView> {
    return this.dataSource.transaction(async (em) => {
      const [head]: ReceiptHead[] = await em.query(
        `SELECT "contract_id" AS "contractId", "facility_id" AS "facilityId", "type", "status"
           FROM "shelf_receipts" WHERE "id" = $1`,
        [receiptId],
      );
      if (!head) notFound('Receipt', receiptId);
      if (!(await managesFacility(em, actor, head.facilityId))) {
        throw new DomainException(
          ErrorCode.FORBIDDEN,
          'Chỉ quản lý của chi nhánh mới hủy được phiếu này',
          HttpStatus.FORBIDDEN,
        );
      }

      const [contract] = await findShelfContracts(em, { contractId: head.contractId, lock: true });
      if (!contract) notFound('Contract', head.contractId);
      // Re-read under the lock: a concurrent void may have won while this one waited.
      const [current]: { status: string }[] = await em.query(
        `SELECT "status" FROM "shelf_receipts" WHERE "id" = $1 FOR UPDATE`,
        [receiptId],
      );
      if (current.status === 'VOIDED') {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Phiếu đã được hủy trước đó',
          HttpStatus.CONFLICT,
          {
            reason: 'ALREADY_VOIDED',
          },
        );
      }
      if (contract.status !== ContractStatus.ACTIVE) {
        throw new DomainException(
          ErrorCode.SHELF_RECEIPT_NOT_ALLOWED,
          'Hợp đồng không còn hiệu lực nên không thể hủy phiếu',
          HttpStatus.CONFLICT,
          { reason: 'CONTRACT_NOT_ACTIVE' },
        );
      }

      const lines: { itemId: string; name: string; quantity: number }[] = await em.query(
        `SELECT "item_id" AS "itemId", "name", "quantity" FROM "shelf_receipt_lines" WHERE "receipt_id" = $1`,
        [receiptId],
      );
      const stock =
        (await loadStock(em, [contract.id], { lock: true, includeEmpty: true })).get(contract.id) ??
        [];
      await reverseReceiptStock(em, head.type, lines, stock);

      const trimmed = reason.trim();
      await em.query(
        `UPDATE "shelf_receipts"
            SET "status" = 'VOIDED', "voided_at" = now(), "voided_by" = $2, "void_reason" = $3
          WHERE "id" = $1`,
        [receiptId, actor.id, trimmed],
      );
      const [receipt] = (await loadReceipts(em, { ids: [receiptId] })).receipts;
      await this.notifications.createForUsers(
        em,
        [contract.customerId],
        voidedNotice(receipt, trimmed),
      );
      return receipt;
    });
  }
}
