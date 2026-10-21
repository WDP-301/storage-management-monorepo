import type { EntityManager } from 'typeorm';

export interface ActiveShelfContract {
  id: string;
  effectiveAt: Date;
}

/**
 * The customer's ACTIVE shelf contracts, optionally only those whose shelf sits in `warehouseId`.
 * The shelf is the contract's current one, so a change request that moved it is respected.
 */
export async function findActiveShelfContracts(
  em: EntityManager,
  customerId: string,
  warehouseId?: string,
): Promise<ActiveShelfContract[]> {
  const params: string[] = [customerId];
  if (warehouseId) params.push(warehouseId);
  const rows: { id: string; effectiveAt: Date }[] = await em.query(
    `SELECT c."id", c."effective_at" AS "effectiveAt"
       FROM "contracts" c
       JOIN "booking_items" bi ON bi."id" = c."booking_item_id"
       JOIN "storage_units" u ON u."id" = bi."storage_unit_id"
      WHERE c."customer_id" = $1
        AND c."status" = 'ACTIVE'
        AND c."deleted_at" IS NULL
        AND u."kind" = 'SHELF'
        ${warehouseId ? 'AND u."parent_id" = $2' : ''}`,
    params,
  );
  return rows;
}
