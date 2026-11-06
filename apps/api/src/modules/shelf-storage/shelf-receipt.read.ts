import { escapeLikePattern } from '@shared/utils/like-pattern.util';
import type {
  EvidenceFile,
  ShelfReceiptLineView,
  ShelfReceiptStatus,
  ShelfReceiptType,
  ShelfReceiptView,
} from '@storage/types';
import type { EntityManager } from 'typeorm';

export interface ReceiptQuery {
  ids?: string[];
  contractIds?: string[];
  warehouseId?: string;
  /** Customer name, phone or receipt code contains. */
  search?: string;
  /** Keeps only the newest N receipts of each contract. */
  recentPerContract?: number;
  /** With `limit`: one page, and the total is counted. */
  page?: number;
  limit?: number;
}

interface RawReceipt {
  id: string;
  code: string;
  type: ShelfReceiptType;
  status: ShelfReceiptStatus;
  contractId: string;
  contractNo: string;
  shelfId: string;
  shelfCode: string;
  shelfName: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  facilityId: string;
  facilityCode: string;
  facilityName: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  performedById: string | null;
  performedByName: string | null;
  createdAt: Date;
  note: string | null;
  photos: EvidenceFile[];
  pickupRequestId: string | null;
  recovered: boolean;
  voidedAt: Date | null;
  voidedById: string | null;
  voidedByName: string | null;
  voidReason: string | null;
}

// Shelf, warehouse and facility come from the receipt's own snapshot columns, so a receipt
// reads the same after a unit change. Contracts are joined without the soft-delete filter.
const FROM = `FROM "shelf_receipts" r
  JOIN "contracts" c ON c."id" = r."contract_id"
  JOIN "storage_units" u ON u."id" = r."storage_unit_id"
  JOIN "storage_units" w ON w."id" = r."warehouse_id"
  JOIN "facilities" f ON f."id" = r."facility_id"
  JOIN "app_users" cu ON cu."id" = r."customer_id"
  LEFT JOIN "app_users" pb ON pb."id" = r."performed_by"
  LEFT JOIN "app_users" vb ON vb."id" = r."voided_by"`;

const staffRef = (id: string | null, fullName: string | null) =>
  id ? { id, fullName: fullName ?? '' } : null;

/**
 * Receipts with their lines, newest first. Two queries however many receipts: the receipts, then
 * all their lines. With `page` and `limit` the matching total is counted as well.
 */
export async function loadReceipts(
  em: EntityManager,
  query: ReceiptQuery,
): Promise<{ receipts: ShelfReceiptView[]; total: number }> {
  const params: unknown[] = [];
  const where: string[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };
  if (query.ids) add('r."id" = ANY(?::uuid[])', query.ids);
  if (query.contractIds) add('r."contract_id" = ANY(?::uuid[])', query.contractIds);
  if (query.warehouseId) add('r."warehouse_id" = ?', query.warehouseId);
  const term = query.search?.trim();
  if (term) {
    add(
      '(r."code" ILIKE ? OR cu."full_name" ILIKE ? OR cu."phone" ILIKE ?)',
      `%${escapeLikePattern(term)}%`,
    );
  }
  if (query.recentPerContract && query.contractIds) {
    // Placeholder numbers are taken from the params already pushed for contractIds.
    const contractParam = params.indexOf(query.contractIds) + 1;
    params.push(query.recentPerContract);
    where.push(
      `r."id" IN (SELECT t."id" FROM (
         SELECT "id", ROW_NUMBER() OVER (PARTITION BY "contract_id" ORDER BY "created_at" DESC, "id") AS rn
           FROM "shelf_receipts" WHERE "contract_id" = ANY($${contractParam}::uuid[])
       ) t WHERE t.rn <= $${params.length})`,
    );
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  let total = 0;
  let paging = '';
  if (query.page && query.limit) {
    const [{ total: counted }]: { total: number }[] = await em.query(
      `SELECT count(*)::int AS "total" ${FROM} ${whereSql}`,
      params,
    );
    total = counted;
    params.push(query.limit, (query.page - 1) * query.limit);
    paging = `LIMIT $${params.length - 1} OFFSET $${params.length}`;
  }

  const rows: RawReceipt[] = await em.query(
    `SELECT r."id", r."code", r."type", r."status", r."contract_id" AS "contractId",
            c."contract_no" AS "contractNo",
            u."id" AS "shelfId", u."code" AS "shelfCode", u."name" AS "shelfName",
            w."id" AS "warehouseId", w."code" AS "warehouseCode", w."name" AS "warehouseName",
            f."id" AS "facilityId", f."code" AS "facilityCode", f."name" AS "facilityName",
            cu."id" AS "customerId", cu."full_name" AS "customerName", cu."phone" AS "customerPhone",
            r."performed_by" AS "performedById", pb."full_name" AS "performedByName",
            r."created_at" AS "createdAt", r."note", r."photos",
            r."pickup_request_id" AS "pickupRequestId", (r."session_id" IS NULL) AS "recovered",
            r."voided_at" AS "voidedAt", r."voided_by" AS "voidedById",
            vb."full_name" AS "voidedByName", r."void_reason" AS "voidReason"
       ${FROM} ${whereSql}
      ORDER BY r."created_at" DESC, r."id" ${paging}`,
    params,
  );
  if (rows.length === 0) return { receipts: [], total };

  const lineRows: (ShelfReceiptLineView & { receiptId: string })[] = await em.query(
    `SELECT "receipt_id" AS "receiptId", "item_id" AS "itemId", "name", "quantity"
       FROM "shelf_receipt_lines" WHERE "receipt_id" = ANY($1::uuid[]) ORDER BY "name", "id"`,
    [rows.map((row) => row.id)],
  );
  const lines = new Map<string, ShelfReceiptLineView[]>();
  for (const { receiptId, ...line } of lineRows) {
    lines.set(receiptId, [...(lines.get(receiptId) ?? []), line]);
  }

  const receipts = rows.map(
    (row): ShelfReceiptView => ({
      id: row.id,
      code: row.code,
      type: row.type,
      status: row.status,
      contractId: row.contractId,
      contractNo: row.contractNo,
      shelf: { id: row.shelfId, code: row.shelfCode, name: row.shelfName },
      warehouse: { id: row.warehouseId, code: row.warehouseCode, name: row.warehouseName },
      facility: { id: row.facilityId, code: row.facilityCode, name: row.facilityName },
      customer: { id: row.customerId, fullName: row.customerName, phone: row.customerPhone },
      performedBy: staffRef(row.performedById, row.performedByName),
      createdAt: row.createdAt,
      note: row.note,
      photos: row.photos ?? [],
      lines: lines.get(row.id) ?? [],
      pickupRequestId: row.pickupRequestId,
      recovered: row.recovered,
      void: row.voidedAt
        ? {
            at: row.voidedAt,
            by: staffRef(row.voidedById, row.voidedByName),
            reason: row.voidReason ?? '',
          }
        : null,
    }),
  );
  return { receipts, total };
}
