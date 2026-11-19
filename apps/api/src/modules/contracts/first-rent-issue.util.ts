import { BookingItem } from '@entities/booking-item.entity';
import type { Contract } from '@entities/contract.entity';
import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import { rentInvoiceAmounts } from '@modules/invoices/rent-invoice-amounts.util';
import { invoiceIssuedNotification } from '@modules/invoices/rent-period-invoice.util';
import type { NotificationsService } from '@modules/notifications/notifications.service';
import { generateInvoiceNo } from '@modules/payments/invoice-no.util';
import { InvoiceItemType, InvoiceStatus, RentalPeriodKind } from '@storage/types';
import Decimal from 'decimal.js';
import type { EntityManager } from 'typeorm';
import { FIRST_RENT_PERIOD_NO, findFirstRentInvoice } from './first-rent.util';

/**
 * Issues the first month's rent of a DRAFT contract: one month at the contract price plus VAT,
 * paid by a transfer whose content carries the invoice number. A free unit is settled from the
 * start. The customer is told, so they can pay from their own phone. Null when one was already
 * issued.
 */
export async function issueFirstRentInvoice(
  em: EntityManager,
  contract: Pick<Contract, 'id' | 'customerId' | 'bookingItemId' | 'monthlyPriceSnapshot'>,
  notifications: NotificationsService,
): Promise<Invoice | null> {
  if (await findFirstRentInvoice(em, contract.id)) return null;

  const item = await em.findOneOrFail(BookingItem, {
    where: { id: contract.bookingItemId },
    relations: { storageUnit: true },
  });
  const amount = new Decimal(contract.monthlyPriceSnapshot);
  const amounts = await rentInvoiceAmounts(em, amount);
  const invoice = await em.save(
    Invoice,
    em.create(Invoice, {
      invoiceNo: generateInvoiceNo(),
      customerId: contract.customerId,
      contractId: contract.id,
      kind: RentalPeriodKind.INITIAL,
      periodNo: FIRST_RENT_PERIOD_NO,
      months: 1,
      monthlyPriceSnapshot: contract.monthlyPriceSnapshot,
      // Nothing to collect on a free unit: it is settled from the start.
      status: amount.gt(0) ? InvoiceStatus.ISSUED : InvoiceStatus.PAID,
      ...amounts,
      issuedAt: new Date(),
    }),
  );
  await em.save(
    InvoiceItem,
    em.create(InvoiceItem, {
      invoiceId: invoice.id,
      storageUnitId: item.storageUnitId,
      itemType: InvoiceItemType.RENT,
      description: `Tiền thuê tháng 1 — kho ${item.storageUnit?.code ?? ''}`.trim(),
      quantity: 1,
      unitAmount: amount.toNumber(),
      amount: amount.toNumber(),
    }),
  );
  if (invoice.status === InvoiceStatus.ISSUED) {
    await notifications.createForUsers(
      em,
      [contract.customerId],
      invoiceIssuedNotification(invoice),
    );
  }
  return invoice;
}
