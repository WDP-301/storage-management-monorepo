import type { Invoice } from '@entities/invoice.entity';
import { InvoiceKind } from '@storage/types';
import type Decimal from 'decimal.js';
import type { EntityManager } from 'typeorm';

/**
 * The booking a DEPOSIT_TOPUP invoice feeds back into. Null for any other kind — the payment
 * then behaves exactly as a rent or fee payment (no booking link, no deposit credit). Also null
 * for a top-up billed by a unit change: that money is applied by the change's settle step (to the
 * destination booking), so crediting the old booking here would double-count it.
 */
export async function topUpBookingId(
  em: EntityManager,
  invoice: Pick<Invoice, 'kind' | 'contractId'> & { id?: string },
): Promise<string | null> {
  if (invoice.kind !== InvoiceKind.DEPOSIT_TOPUP || !invoice.contractId) return null;
  if (invoice.id && (await isChangeRequestTopUp(em, invoice.id))) return null;
  const [row] = (await em.query(
    `SELECT bi.booking_id AS "bookingId" FROM contracts c
       JOIN booking_items bi ON bi.id = c.booking_item_id
      WHERE c.id = $1`,
    [invoice.contractId],
  )) as Array<{ bookingId: string }>;
  return row?.bookingId ?? null;
}

/** The unit-change request that billed this DEPOSIT_TOPUP invoice, if any. */
export async function topUpChangeRequestId(
  em: EntityManager,
  invoice: Pick<Invoice, 'kind'> & { id: string },
): Promise<string | null> {
  if (invoice.kind !== InvoiceKind.DEPOSIT_TOPUP) return null;
  const [row] = (await em.query(
    `SELECT id FROM unit_change_requests WHERE topup_invoice_id = $1 LIMIT 1`,
    [invoice.id],
  )) as Array<{ id: string }>;
  return row?.id ?? null;
}

async function isChangeRequestTopUp(em: EntityManager, invoiceId: string): Promise<boolean> {
  const rows: unknown[] = await em.query(
    `SELECT 1 FROM unit_change_requests WHERE topup_invoice_id = $1 LIMIT 1`,
    [invoiceId],
  );
  return rows.length > 0;
}

/**
 * Money collected on a top-up invoice is additional deposit held. The ledger derives what is
 * held from `bookings.deposit_total` (not a payment sum), so every succeeded top-up payment
 * bumps it — for one item the derived held equals the total, for a changed item the total minus
 * the unchanged items' snapshots; both move by exactly the payment amount.
 */
export async function creditDepositTopUp(
  em: EntityManager,
  bookingId: string | null,
  amount: Decimal.Value,
): Promise<void> {
  if (!bookingId) return;
  await em.query(`UPDATE bookings SET deposit_total = deposit_total + $1 WHERE id = $2`, [
    amount,
    bookingId,
  ]);
}
