import { Invoice } from '@entities/invoice.entity';
import { Payment } from '@entities/payment.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { InvoiceStatus, PaymentStatus, StorageUnitStatus } from '@storage/types';
import type { EntityManager } from 'typeorm';

/**
 * Gives a booked move its target unit back and voids the deposit top-up it billed — unless
 * money already landed on that invoice, in which case it stays: paid funds sit in the held
 * deposit and the end-of-contract settlement hands them back.
 *
 * The invoice is taken under a pessimistic row lock — the same lock the SePay listener takes
 * before recording a payment — so the paid-check and the void cannot race a commit.
 */
export async function releaseMoveHold(
  manager: EntityManager,
  request: { newUnitId?: string | null; topupInvoiceId?: string | null },
): Promise<void> {
  if (request.newUnitId) {
    // Conditional on HELD: whatever state the unit is actually in, only a move-hold is ours
    // to release — a unit since pulled or re-rented is left alone.
    await manager.update(
      StorageUnit,
      { id: request.newUnitId, status: StorageUnitStatus.HELD },
      { status: StorageUnitStatus.AVAILABLE },
    );
  }
  if (request.topupInvoiceId) {
    const invoice = await manager.findOne(Invoice, {
      where: { id: request.topupInvoiceId },
      lock: { mode: 'pessimistic_write' },
    });
    if (invoice && invoice.status !== InvoiceStatus.VOID) {
      const paidCount = await manager.count(Payment, {
        where: { invoiceId: invoice.id, status: PaymentStatus.SUCCEEDED },
      });
      if (paidCount === 0) {
        await manager.update(Invoice, { id: invoice.id }, { status: InvoiceStatus.VOID });
      }
    }
  }
}
