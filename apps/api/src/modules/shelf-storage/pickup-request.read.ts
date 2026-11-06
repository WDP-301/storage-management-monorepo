import type { PickupRequestLine } from '@entities/pickup-request.entity';
import type {
  PickupRequestStatus,
  PickupRequestView,
  ShelfPersonRef,
  ShelfRef,
  ShelfStaffRef,
} from '@storage/types';
import type { EntityManager } from 'typeorm';

export interface PickupRequestQuery {
  ids?: string[];
  contractIds?: string[];
  warehouseId?: string;
  /** Only PENDING and READY requests. */
  open?: boolean;
  limit?: number;
  /** `requestedFor`: soonest first; `newest`: latest created first. */
  order: 'requestedFor' | 'newest';
}

interface RawRequest {
  id: string;
  status: PickupRequestStatus;
  contractId: string;
  contractNo: string;
  shelfId: string;
  shelfCode: string;
  shelfName: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  requestedFor: Date;
  note: string | null;
  lines: PickupRequestLine[];
  createdAt: Date;
  readyAt: Date | null;
  readyById: string | null;
  readyByName: string | null;
  cancelledAt: Date | null;
  cancelledById: string | null;
  completedAt: Date | null;
  completedReceiptId: string | null;
}

/**
 * Pick-up requests as the API returns them. Line quantities are what was asked; `available` is
 * the item's stock right now, so staff and the customer see whether the request can still be met.
 */
export async function loadPickupRequests(
  em: EntityManager,
  query: PickupRequestQuery,
): Promise<PickupRequestView[]> {
  const params: unknown[] = [];
  const where: string[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (query.ids) add('r."id" = ANY(?::uuid[])', query.ids);
  if (query.contractIds) add('r."contract_id" = ANY(?::uuid[])', query.contractIds);
  if (query.warehouseId) add('w."id" = ?', query.warehouseId);
  if (query.open) where.push(`r."status" IN ('PENDING','READY')`);
  const order =
    query.order === 'requestedFor'
      ? 'r."requested_for" ASC, r."id"'
      : 'r."created_at" DESC, r."id"';
  let limit = '';
  if (query.limit) {
    params.push(query.limit);
    limit = `LIMIT $${params.length}`;
  }

  const rows: RawRequest[] = await em.query(
    `SELECT r."id", r."status", r."contract_id" AS "contractId", c."contract_no" AS "contractNo",
            u."id" AS "shelfId", u."code" AS "shelfCode", u."name" AS "shelfName",
            w."id" AS "warehouseId", w."code" AS "warehouseCode", w."name" AS "warehouseName",
            cu."id" AS "customerId", cu."full_name" AS "customerName", cu."phone" AS "customerPhone",
            r."requested_for" AS "requestedFor", r."note", r."lines", r."created_at" AS "createdAt",
            r."ready_at" AS "readyAt", r."ready_by" AS "readyById", rb."full_name" AS "readyByName",
            r."cancelled_at" AS "cancelledAt", r."cancelled_by" AS "cancelledById",
            r."completed_at" AS "completedAt", sr."id" AS "completedReceiptId"
       FROM "pickup_requests" r
       JOIN "contracts" c ON c."id" = r."contract_id"
       JOIN "booking_items" bi ON bi."id" = c."booking_item_id"
       JOIN "storage_units" u ON u."id" = bi."storage_unit_id"
       JOIN "storage_units" w ON w."id" = u."parent_id"
       JOIN "app_users" cu ON cu."id" = r."customer_id"
       LEFT JOIN "app_users" rb ON rb."id" = r."ready_by"
       LEFT JOIN "shelf_receipts" sr ON sr."pickup_request_id" = r."id"
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${order}
      ${limit}`,
    params,
  );
  if (rows.length === 0) return [];

  const itemIds = [...new Set(rows.flatMap((row) => row.lines.map((line) => line.itemId)))];
  const stock: { id: string; quantity: number }[] =
    itemIds.length > 0
      ? await em.query(`SELECT "id", "quantity" FROM "shelf_items" WHERE "id" = ANY($1::uuid[])`, [
          itemIds,
        ])
      : [];
  const available = new Map(stock.map((item) => [item.id, item.quantity]));

  return rows.map((row) => {
    const shelf: ShelfRef = { id: row.shelfId, code: row.shelfCode, name: row.shelfName };
    const warehouse: ShelfRef = {
      id: row.warehouseId,
      code: row.warehouseCode,
      name: row.warehouseName,
    };
    const customer: ShelfPersonRef = {
      id: row.customerId,
      fullName: row.customerName,
      phone: row.customerPhone,
    };
    const readyBy: ShelfStaffRef | null = row.readyById
      ? { id: row.readyById, fullName: row.readyByName ?? '' }
      : null;
    const cancelledBy =
      row.status !== 'CANCELLED' ? null : row.cancelledById ? 'CUSTOMER' : 'SYSTEM';
    return {
      id: row.id,
      status: row.status,
      contractId: row.contractId,
      contractNo: row.contractNo,
      shelf,
      warehouse,
      customer,
      requestedFor: row.requestedFor,
      note: row.note,
      lines: row.lines.map((line) => ({ ...line, available: available.get(line.itemId) ?? 0 })),
      createdAt: row.createdAt,
      readyAt: row.readyAt,
      readyBy,
      cancelledAt: row.cancelledAt,
      cancelledBy,
      completedAt: row.completedAt,
      completedReceiptId: row.completedReceiptId,
    };
  });
}
