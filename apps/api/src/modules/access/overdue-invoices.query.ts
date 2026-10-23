import { startOfVietnamDay } from '@shared/utils/calendar.util';
import type { EntityManager } from 'typeorm';

const MAX_LISTED = 5;

/**
 * Numbers of the customer's unpaid invoices past their due date (in Vietnam calendar days).
 * Invoices of draft, cancelled or deleted contracts are ignored, while invoices tied to no
 * contract still count. Raw SQL keeps soft-deleted contracts visible to the filter.
 */
export async function findOverdueInvoiceNos(
  em: EntityManager,
  customerId: string,
  now: Date,
): Promise<string[]> {
  const rows: { invoiceNo: string }[] = await em.query(
    `SELECT i."invoice_no" AS "invoiceNo"
       FROM "invoices" i
       LEFT JOIN "contracts" c ON c."id" = i."contract_id"
      WHERE i."customer_id" = $1
        AND i."status" IN ('ISSUED', 'PARTIALLY_PAID')
        AND i."due_at" IS NOT NULL
        AND i."due_at" < $2
        AND (i."contract_id" IS NULL OR (c."status" NOT IN ('DRAFT', 'CANCELLED') AND c."deleted_at" IS NULL))
      ORDER BY i."due_at"
      LIMIT ${MAX_LISTED}`,
    [customerId, startOfVietnamDay(now)],
  );
  return rows.map((row) => row.invoiceNo);
}
