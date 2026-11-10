import type { Invoice } from '@entities/invoice.entity';
import { InvoiceKind } from '@storage/types';
import type Decimal from 'decimal.js';
import type { EntityManager } from 'typeorm';

/**
 * The booking a DEPOSIT_TOPUP invoice feeds back into. Null for any other kind — the payment
 * then behaves exactly as a rent or fee payment (no booking link, no deposit credit).
 */
export async function topUpBookingId(
  em: EntityManager,
  invoice: Pick<Invoice, 'kind' | 'contractId'>,
): Promise<string | null> {
  if (invoice.kind !== InvoiceKind.DEPOSIT_TOPUP || !invoice.contractId) return null;
  const [row] = (await em.query(
    `SELECT bi.booking_id AS "bookingId" FROM contracts c
       JOIN booking_items bi ON bi.id = c.booking_item_id
      WHERE c.id = $1`,
    [invoice.contractId],
  )) as Array<{ bookingId: string }>;
  return row?.bookingId ?? null;
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
