import { StorageUnit } from '@entities/storage-unit.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { managesFacility } from '@modules/inspection/inspection-access.util';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import {
  type AbandonedShelfContractView,
  ContractStatus,
  type CreateShelfRecoveryInput,
  ReturnRequestSource,
  ShelfReceiptType,
  type ShelfReceiptView,
  StorageUnitKind,
} from '@storage/types';
import { DataSource, type EntityManager } from 'typeorm';
import { validateRecoveryShape } from './receipt-input.util';
import { applyPickUp } from './receipt-stock.util';
import { findReplay, insertReceipt, withReceiptCodeRetry } from './receipt-writer.util';
import { findShelfContracts, loadStock } from './shelf-contract.query';
import { cancelOpenPickupRequestsIfEmptied } from './shelf-empty-guard.util';
import { receiptNotice } from './shelf-notifications';
import { loadReceipts } from './shelf-receipt.read';

const notAllowed = (reason: string, message: string) =>
  new DomainException(ErrorCode.SHELF_RECEIPT_NOT_ALLOWED, message, HttpStatus.CONFLICT, {
    reason,
  });

const forbidden = () =>
  new DomainException(
    ErrorCode.FORBIDDEN,
    'Chỉ quản lý của chi nhánh mới được thu hồi đồ',
    HttpStatus.FORBIDDEN,
  );

interface AbandonedRow {
  contractId: string;
  contractNo: string;
  shelfId: string;
  shelfCode: string;
  shelfName: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  returnScheduledAt: Date;
}

/** Scan-less pick-up by a manager on a shelf whose customer abandoned it. */
@Injectable()
export class ShelfRecoveryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  /** Contracts of the warehouse with an open ABANDONED return and goods still on the shelf. */
  async list(actor: AuthUser, warehouseId: string): Promise<AbandonedShelfContractView[]> {
    const em = this.dataSource.manager;
    const warehouse = await em.findOne(StorageUnit, {
      where: { id: warehouseId, kind: StorageUnitKind.SHELF_WAREHOUSE },
    });
    if (!warehouse) notFound('Warehouse', warehouseId);
    if (!(await managesFacility(em, actor, warehouse.facilityId))) throw forbidden();

    const rows: AbandonedRow[] = await em.query(
      `SELECT c."id" AS "contractId", c."contract_no" AS "contractNo",
              u."id" AS "shelfId", u."code" AS "shelfCode", u."name" AS "shelfName",
              cu."id" AS "customerId", cu."full_name" AS "customerName", cu."phone" AS "customerPhone",
              i."scheduled_at" AS "returnScheduledAt"
         FROM "contracts" c
         JOIN "booking_items" bi ON bi."id" = c."booking_item_id"
         JOIN "storage_units" u ON u."id" = bi."storage_unit_id" AND u."kind" = 'SHELF'
         JOIN "app_users" cu ON cu."id" = c."customer_id"
         JOIN "inspections" i ON i."contract_id" = c."id" AND i."type" = 'RETURN'
          AND i."finalized_at" IS NULL AND i."request_source" = $2
        WHERE u."parent_id" = $1 AND c."status" = $3 AND c."deleted_at" IS NULL
          AND EXISTS (SELECT 1 FROM "shelf_items" s WHERE s."contract_id" = c."id" AND s."quantity" > 0)
        ORDER BY i."scheduled_at", c."id"`,
      [warehouseId, ReturnRequestSource.ABANDONED, ContractStatus.ACTIVE],
    );
    const stock = await loadStock(
      em,
      rows.map((row) => row.contractId),
    );
    return rows.map((row) => ({
      contractId: row.contractId,
      contractNo: row.contractNo,
      shelf: { id: row.shelfId, code: row.shelfCode, name: row.shelfName },
      customer: { id: row.customerId, fullName: row.customerName, phone: row.customerPhone },
      returnScheduledAt: row.returnScheduledAt,
      items: stock.get(row.contractId) ?? [],
    }));
  }

  /**
   * A PICK_UP without a session: same locks, stock rules and replay safety as at the counter, but
   * only for a manager, only on an ACTIVE contract with an open ABANDONED return, and never
   * blocked by debt. It never completes a request, but one still open is cancelled when this empties the shelf.
   */
  async create(actor: AuthUser, input: CreateShelfRecoveryInput): Promise<ShelfReceiptView> {
    const lines = validateRecoveryShape(input, actor.id);
    return withReceiptCodeRetry(this.dataSource, async (em) => {
      const [contract] = await findShelfContracts(em, { contractId: input.contractId, lock: true });
      if (!contract) notFound('Contract', input.contractId);
      if (!(await managesFacility(em, actor, contract.facility.id))) throw forbidden();

      const replay = await findReplay(em, input.clientRequestId, contract.id);
      if (replay) return replay;

      if (contract.status !== ContractStatus.ACTIVE) {
        throw notAllowed('CONTRACT_NOT_ACTIVE', 'Hợp đồng không còn hiệu lực');
      }
      if (!(await this.hasOpenAbandonedReturn(em, contract.id))) {
        throw notAllowed(
          'NOT_ABANDONED_RETURN',
          'Chỉ thu hồi đồ khi kệ đã được yêu cầu trả với lý do khách bỏ kệ',
        );
      }

      const stock =
        (await loadStock(em, [contract.id], { lock: true, includeEmpty: true })).get(contract.id) ??
        [];
      const applied = await applyPickUp(em, lines, stock);
      const id = await insertReceipt(em, {
        type: ShelfReceiptType.PICK_UP,
        contract,
        sessionId: null,
        clientRequestId: input.clientRequestId,
        performedBy: actor.id,
        note: input.note.trim(),
        photos: input.photos,
        pickupRequestId: null,
        lines: applied,
      });
      await cancelOpenPickupRequestsIfEmptied(em, contract.id, stock, applied);
      const [receipt] = (await loadReceipts(em, { ids: [id] })).receipts;
      await this.notifications.createForUsers(em, [contract.customerId], receiptNotice(receipt));
      return receipt;
    });
  }

  private async hasOpenAbandonedReturn(em: EntityManager, contractId: string): Promise<boolean> {
    const rows: unknown[] = await em.query(
      `SELECT 1 FROM "inspections"
        WHERE "contract_id" = $1 AND "type" = 'RETURN' AND "finalized_at" IS NULL
          AND "request_source" = $2 LIMIT 1`,
      [contractId, ReturnRequestSource.ABANDONED],
    );
    return rows.length > 0;
  }
}
