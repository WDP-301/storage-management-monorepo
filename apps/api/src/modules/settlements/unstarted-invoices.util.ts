import { fromVietnamDate } from '@shared/utils/calendar.util';
import { InvoiceKind, InvoiceStatus } from '@storage/types';
import type { EntityManager } from 'typeorm';

export interface VoidedInvoice {
  id: string;
  invoiceNo: string;
}

/**
 * Voids the contract's rent invoices for periods starting on or after `effectiveReturnDay`
 * (00:00 Vietnam time), paid or not: the customer no longer uses them. A period already running
 * on that day is kept, and settlement invoices are never touched. Money already paid on a voided
 * invoice is credited back when the deposit is settled.
 *
 * The UPDATE takes the invoice row locks, so it queues behind a payment being recorded on the
 * same invoice; a transfer arriving after the void is recorded for review instead of settling it.
 */
export async function voidUnstartedInvoices(
  em: EntityManager,
  contractId: string,
  effectiveReturnDay: string,
): Promise<VoidedInvoice[]> {
  const [rows]: [VoidedInvoice[], number] = await em.query(
    `UPDATE invoices SET status = $3
      WHERE contract_id = $1 AND kind <> $4 AND status <> $3 AND start_at >= $2
      RETURNING id, invoice_no AS "invoiceNo"`,
    [contractId, fromVietnamDate(effectiveReturnDay), InvoiceStatus.VOID, InvoiceKind.SETTLEMENT],
  );
  return rows;
}
