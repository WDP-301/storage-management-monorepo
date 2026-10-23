import type { CheckOutMethod } from '@storage/types';

/** A visit as staff and customers see it: one used CHECK_IN row and how it ended, if it has. */
export interface VisitView {
  id: string;
  checkedInAt: Date;
  checkedOutAt: Date | null;
  checkOutMethod: CheckOutMethod | null;
  checkOutNote: string | null;
  customer: { fullName: string | null; phone: string | null };
  warehouse: { id: string; code: string; name: string } | null;
  facility: { code: string; name: string } | null;
}

/** Column list for `toVisitView`; the caller adds FROM "access_events" e plus the joins below. */
export const VISIT_COLUMNS = `
  e."id", e."used_at" AS "checkedInAt", e."checked_out_at" AS "checkedOutAt",
  e."check_out_method" AS "checkOutMethod", e."check_out_note" AS "checkOutNote",
  cu."full_name" AS "customerName", cu."phone" AS "customerPhone",
  w."id" AS "warehouseId", w."code" AS "warehouseCode", w."name" AS "warehouseName",
  f."code" AS "facilityCode", f."name" AS "facilityName"`;

export const VISIT_JOINS = `
  JOIN "app_users" cu ON cu."id" = e."customer_id"
  LEFT JOIN "storage_units" w ON w."id" = e."warehouse_id"
  LEFT JOIN "facilities" f ON f."id" = e."facility_id"`;

export type VisitRow = {
  id: string;
  checkedInAt: Date;
  checkedOutAt: Date | null;
  checkOutMethod: CheckOutMethod | null;
  checkOutNote: string | null;
  customerName: string | null;
  customerPhone: string | null;
  warehouseId: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  facilityCode: string | null;
  facilityName: string | null;
};

export function toVisitView(row: VisitRow): VisitView {
  return {
    id: row.id,
    checkedInAt: row.checkedInAt,
    checkedOutAt: row.checkedOutAt ?? null,
    checkOutMethod: row.checkOutMethod ?? null,
    checkOutNote: row.checkOutNote ?? null,
    customer: { fullName: row.customerName ?? null, phone: row.customerPhone ?? null },
    warehouse:
      row.warehouseId && row.warehouseCode
        ? { id: row.warehouseId, code: row.warehouseCode, name: row.warehouseName ?? '' }
        : null,
    facility: row.facilityCode ? { code: row.facilityCode, name: row.facilityName ?? '' } : null,
  };
}
