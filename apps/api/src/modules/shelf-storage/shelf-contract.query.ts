import type { ContractStatus, ShelfItemView, ShelfRef } from '@storage/types';
import type { EntityManager } from 'typeorm';

export interface ShelfContractRow {
  id: string;
  contractNo: string;
  status: ContractStatus;
  customerId: string;
  effectiveAt: Date;
  shelf: ShelfRef;
  warehouse: ShelfRef;
  facility: ShelfRef;
  /** A RETURN inspection exists and is not finalized. */
  returnOpen: boolean;
}

export interface ShelfContractFilter {
  contractId?: string;
  customerId?: string;
  warehouseId?: string;
  statuses?: ContractStatus[];
  /**
   * Locks the contract (`FOR NO KEY UPDATE`) so stock changes serialize per contract. Needs
   * `contractId`. The lock is its own statement: in READ COMMITTED a statement that waited on a
   * lock only re-reads the locked row, so a join in the same statement could still show the shelf
   * the contract had before a concurrent unit change.
   */
  lock?: boolean;
}

interface RawRow {
  id: string;
  contractNo: string;
  status: ContractStatus;
  customerId: string;
  effectiveAt: Date;
  shelfId: string;
  shelfCode: string;
  shelfName: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  facilityId: string;
  facilityCode: string;
  facilityName: string;
  returnOpen: boolean;
}

/**
 * Shelf contracts with their current shelf (through the booking item, so a unit change is
 * respected), warehouse and facility. Contracts on non-shelf units never appear.
 */
export async function findShelfContracts(
  em: EntityManager,
  filter: ShelfContractFilter = {},
): Promise<ShelfContractRow[]> {
  if (filter.lock) {
    if (!filter.contractId) throw new Error('findShelfContracts: lock requires contractId');
    await em.query(
      `SELECT 1 FROM "contracts" WHERE "id" = ANY($1::uuid[]) ORDER BY "id" FOR NO KEY UPDATE`,
      [[filter.contractId]],
    );
  }
  const params: unknown[] = [];
  const where = ['c."deleted_at" IS NULL'];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (filter.contractId) add('c."id" = ?', filter.contractId);
  if (filter.customerId) add('c."customer_id" = ?', filter.customerId);
  if (filter.warehouseId) add('w."id" = ?', filter.warehouseId);
  if (filter.statuses) add('c."status" = ANY(?::text[])', filter.statuses);

  const rows: RawRow[] = await em.query(
    `SELECT c."id", c."contract_no" AS "contractNo", c."status", c."customer_id" AS "customerId",
            c."effective_at" AS "effectiveAt",
            u."id" AS "shelfId", u."code" AS "shelfCode", u."name" AS "shelfName",
            w."id" AS "warehouseId", w."code" AS "warehouseCode", w."name" AS "warehouseName",
            f."id" AS "facilityId", f."code" AS "facilityCode", f."name" AS "facilityName",
            EXISTS (
              SELECT 1 FROM "inspections" i
               WHERE i."contract_id" = c."id" AND i."type" = 'RETURN' AND i."finalized_at" IS NULL
            ) AS "returnOpen"
       FROM "contracts" c
       JOIN "booking_items" bi ON bi."id" = c."booking_item_id"
       JOIN "storage_units" u ON u."id" = bi."storage_unit_id" AND u."kind" = 'SHELF'
       JOIN "storage_units" w ON w."id" = u."parent_id"
       JOIN "facilities" f ON f."id" = w."facility_id"
      WHERE ${where.join(' AND ')}
      ORDER BY c."effective_at", c."id"`,
    params,
  );
  return rows.map((row) => ({
    id: row.id,
    contractNo: row.contractNo,
    status: row.status,
    customerId: row.customerId,
    effectiveAt: row.effectiveAt,
    shelf: { id: row.shelfId, code: row.shelfCode, name: row.shelfName },
    warehouse: { id: row.warehouseId, code: row.warehouseCode, name: row.warehouseName },
    facility: { id: row.facilityId, code: row.facilityCode, name: row.facilityName },
    returnOpen: row.returnOpen,
  }));
}

export interface LoadStockOptions {
  /** Locks the item rows in id order (`FOR UPDATE`), after the contract rows. */
  lock?: boolean;
  /** Keeps items emptied to 0; hidden by default. */
  includeEmpty?: boolean;
}

/** Current stock per contract, name ascending; contracts with nothing stored map to `[]`. */
export async function loadStock(
  em: EntityManager,
  contractIds: string[],
  options: LoadStockOptions = {},
): Promise<Map<string, ShelfItemView[]>> {
  const stock = new Map<string, ShelfItemView[]>(contractIds.map((id) => [id, []]));
  if (contractIds.length === 0) return stock;
  const rows: (ShelfItemView & { contractId: string })[] = await em.query(
    `SELECT "id", "contract_id" AS "contractId", "name", "quantity", "updated_at" AS "updatedAt"
       FROM "shelf_items"
      WHERE "contract_id" = ANY($1::uuid[]) ${options.includeEmpty ? '' : 'AND "quantity" > 0'}
      ${options.lock ? 'ORDER BY "id" FOR UPDATE' : 'ORDER BY "name" ASC, "id"'}`,
    [contractIds],
  );
  for (const { contractId, ...item } of rows) stock.get(contractId)?.push(item);
  return stock;
}
