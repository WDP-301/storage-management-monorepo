import type { DropOffRequestLine } from '@entities/drop-off-request.entity';
import type {
  DropOffRequestStatus,
  DropOffRequestView,
  ShelfPersonRef,
  ShelfRef,
  ShelfStaffRef,
} from '@storage/types';
import type { EntityManager } from 'typeorm';

export interface DropOffRequestQuery {
  ids?: string[];
  contractIds?: string[];
  warehouseId?: string;
  /** Only PENDING and CONFIRMED requests. */
  open?: boolean;
  limit?: number;
  /** `requestedFor`: soonest first; `newest`: latest created first. */
  order: 'requestedFor' | 'newest';
}

interface RawRequest {
  id: string;
  status: DropOffRequestStatus;
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
  lines: DropOffRequestLine[];
  createdAt: Date;
  confirmedAt: Date | null;
  confirmedById: string | null;
  confirmedByName: string | null;
  cancelledAt: Date | null;
  cancelledById: string | null;
  completedAt: Date | null;
  completedReceiptId: string | null;
}

/** Drop-off requests as the API returns them, with the shelf the contract holds now. */
export async function loadDropOffRequests(
  em: EntityManager,
  query: DropOffRequestQuery,
): Promise<DropOffRequestView[]> {
  const params: unknown[] = [];
  const where: string[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (query.ids) add('r."id" = ANY(?::uuid[])', query.ids);
  if (query.contractIds) add('r."contract_id" = ANY(?::uuid[])', query.contractIds);
  if (query.warehouseId) add('w."id" = ?', query.warehouseId);
  if (query.open) where.push(`r."status" IN ('PENDING','CONFIRMED')`);
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
            r."confirmed_at" AS "confirmedAt", r."confirmed_by" AS "confirmedById",
            cb."full_name" AS "confirmedByName",
            r."cancelled_at" AS "cancelledAt", r."cancelled_by" AS "cancelledById",
            r."completed_at" AS "completedAt", sr."id" AS "completedReceiptId"
       FROM "drop_off_requests" r
       JOIN "contracts" c ON c."id" = r."contract_id"
       JOIN "booking_items" bi ON bi."id" = c."booking_item_id"
       JOIN "storage_units" u ON u."id" = bi."storage_unit_id"
       JOIN "storage_units" w ON w."id" = u."parent_id"
       JOIN "app_users" cu ON cu."id" = r."customer_id"
       LEFT JOIN "app_users" cb ON cb."id" = r."confirmed_by"
       LEFT JOIN "shelf_receipts" sr ON sr."drop_off_request_id" = r."id"
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${order}
      ${limit}`,
    params,
  );

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
    const confirmedBy: ShelfStaffRef | null = row.confirmedById
      ? { id: row.confirmedById, fullName: row.confirmedByName ?? '' }
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
      lines: row.lines.map((line) => ({
        itemId: line.itemId ?? null,
        name: line.name,
        quantity: line.quantity,
      })),
      createdAt: row.createdAt,
      confirmedAt: row.confirmedAt,
      confirmedBy,
      cancelledAt: row.cancelledAt,
      cancelledBy,
      completedAt: row.completedAt,
      completedReceiptId: row.completedReceiptId,
    };
  });
}
