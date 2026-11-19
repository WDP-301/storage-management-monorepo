import {
  ContractStatus,
  InspectionType,
  InvoiceStatus,
  type PendingShelfContractView,
  RentalPeriodKind,
} from '@storage/types';
import type { EntityManager } from 'typeorm';

interface PendingRow {
  contractId: string;
  contractNo: string;
  effectiveAt: Date;
  hasSignedFiles: boolean;
  firstRentPaid: boolean;
  shelfId: string;
  shelfCode: string;
  shelfName: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
}

/**
 * DRAFT shelf contracts of a warehouse that wait to take effect without a handover (signed files
 * and/or the first month still missing), earliest start first. Old contracts that still carry a
 * handover inspection go through it and are left out.
 */
export async function loadPendingShelfContracts(
  em: EntityManager,
  warehouseId: string,
): Promise<PendingShelfContractView[]> {
  const rows: PendingRow[] = await em.query(
    `SELECT c."id" AS "contractId", c."contract_no" AS "contractNo", c."effective_at" AS "effectiveAt",
            jsonb_array_length(c."documents") > 0 AS "hasSignedFiles",
            EXISTS (SELECT 1 FROM "invoices" i
                     WHERE i."contract_id" = c."id" AND i."kind" = $3 AND i."period_no" = 1
                       AND i."status" = $4) AS "firstRentPaid",
            u."id" AS "shelfId", u."code" AS "shelfCode", u."name" AS "shelfName",
            cu."id" AS "customerId", cu."full_name" AS "customerName", cu."phone" AS "customerPhone"
       FROM "contracts" c
       JOIN "booking_items" bi ON bi."id" = c."booking_item_id"
       JOIN "storage_units" u ON u."id" = bi."storage_unit_id" AND u."kind" = 'SHELF'
       JOIN "app_users" cu ON cu."id" = c."customer_id"
      WHERE u."parent_id" = $1 AND c."status" = $2 AND c."deleted_at" IS NULL
        AND NOT EXISTS (SELECT 1 FROM "inspections" h
                         WHERE h."contract_id" = c."id" AND h."type" = $5)
      ORDER BY c."effective_at", c."id"`,
    [
      warehouseId,
      ContractStatus.DRAFT,
      RentalPeriodKind.INITIAL,
      InvoiceStatus.PAID,
      InspectionType.PRE_HANDOVER,
    ],
  );
  return rows.map((row) => ({
    contractId: row.contractId,
    contractNo: row.contractNo,
    shelf: { id: row.shelfId, code: row.shelfCode, name: row.shelfName },
    customer: { id: row.customerId, fullName: row.customerName, phone: row.customerPhone },
    effectiveAt: row.effectiveAt,
    hasSignedFiles: row.hasSignedFiles,
    firstRentPaid: row.firstRentPaid,
  }));
}
