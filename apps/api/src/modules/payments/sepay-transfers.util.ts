import { SepayTransferOutcome } from '@storage/types';
import type { EntityManager } from 'typeorm';

/**
 * Record the outcome a listener reached for a transfer. Two listeners look at the same
 * delivery (booking deposits and invoice payments); negative outcomes only land while the row
 * is still RECEIVED so a positive outcome from the other listener is never overwritten, and
 * RESOLVED — set by a human — is never touched.
 */
export async function markSepayOutcome(
  em: EntityManager,
  sepayId: string,
  outcome: SepayTransferOutcome,
  refs: { bookingId?: string | null; invoiceId?: string | null } = {},
): Promise<void> {
  const negative =
    outcome === SepayTransferOutcome.UNMATCHED || outcome === SepayTransferOutcome.AMBIGUOUS;
  await em.query(
    `UPDATE "sepay_transfers"
        SET "outcome" = $2,
            "booking_id" = coalesce($3::uuid, "booking_id"),
            "invoice_id" = coalesce($4::uuid, "invoice_id")
      WHERE "sepay_id" = $1 AND "outcome" <> 'RESOLVED'
        ${negative ? `AND "outcome" = 'RECEIVED'` : ''}`,
    [sepayId, outcome, refs.bookingId ?? null, refs.invoiceId ?? null],
  );
}
