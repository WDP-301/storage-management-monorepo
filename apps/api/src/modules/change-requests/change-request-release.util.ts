import { Invoice } from '@entities/invoice.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { InvoiceStatus, StorageUnitStatus } from '@storage/types';
import type { EntityManager } from 'typeorm';

/**
 * Gives a booked move its target unit back and voids the deposit top-up invoice it billed.
 * Because a unit-change top-up is never added to the deposit ledger while AWAITING_PAYMENT,
 * voiding it prevents late payments, prevents settlement from charging any unpaid remainder as
 * debt, and lets settlement credit back any partial or unsettled payment already received.
 *
 * The invoice is taken under a pessimistic row lock — the same lock the SePay listener takes
 * before recording a payment — so the void and a concurrent transfer cannot interleave.
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
      await manager.update(Invoice, { id: invoice.id }, { status: InvoiceStatus.VOID });
    }
  }
}
