import { Invoice } from '@entities/invoice.entity';
import { Payment } from '@entities/payment.entity';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { extractInvoiceNos } from '@modules/payments/invoice-no.util';
import { generatePaymentNo } from '@modules/payments/payment-no.util';
import { PAYMENT_EVENTS, PaymentReceivedEvent } from '@modules/payments/types/payment';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { isUniqueViolation } from '@shared/utils/pg-error.util';
import { InvoiceStatus, PaymentMethod, PaymentStatus, PaymentType } from '@storage/types';
import { DataSource, In } from 'typeorm';
import { PAYABLE_INVOICE_STATUSES, sumInvoicePayments } from './first-rent.util';

/**
 * Settles invoices from SePay transfers whose content carries the invoice number. Booking
 * deposits are matched by the bookings listener; transfers without an invoice number are
 * not ours. Money is always recorded, even when it cannot settle anything (invoice already
 * paid or voided), so it can be reconciled by hand.
 */
@Injectable()
export class FirstRentPaymentListener {
  private readonly logger = new Logger(FirstRentPaymentListener.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent(PAYMENT_EVENTS.RECEIVED, { async: true })
  async handlePaymentReceived(event: PaymentReceivedEvent): Promise<void> {
    const candidates = extractInvoiceNos(event.content);
    if (candidates.length === 0) return;

    const invoices = await this.dataSource
      .getRepository(Invoice)
      .find({ where: { invoiceNo: In(candidates) } });
    // One transfer must map to exactly one invoice; otherwise leave it for manual reconciliation.
    if (invoices.length !== 1) {
      this.logger.warn(
        `Payment sepayId=${event.sepayId} matches ${invoices.length} invoices for [${candidates.join(', ')}], skipping`,
      );
      return;
    }
    const providerRef = String(event.sepayId);

    try {
      const outcome = await this.dataSource.transaction(async (em) => {
        // Serialize deliveries for this invoice so the paid sum is computed on committed rows.
        const invoice = await em.findOne(Invoice, {
          where: { id: invoices[0].id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!invoice) return 'gone';
        if (await em.getRepository(Payment).exists({ where: { providerRef } })) {
          return 'already-recorded';
        }
        const payable = PAYABLE_INVOICE_STATUSES.includes(invoice.status);
        await em.save(Payment, {
          paymentNo: generatePaymentNo(),
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          type: PaymentType.RENT,
          method: PaymentMethod.BANK_TRANSFER,
          status: PaymentStatus.SUCCEEDED,
          amount: event.amount,
          providerRef,
          paidAt: new Date(event.transactionDate),
          metadata: payable ? {} : { needsReview: `invoice ${invoice.status}` },
        });
        if (!payable) return 'needs-review';

        const paid = await sumInvoicePayments(em, invoice.id);
        const status = paid.gte(invoice.total) ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
        await em.update(Invoice, { id: invoice.id }, { status });
        return status;
      });
      this.logger.log(
        `Payment sepayId=${event.sepayId} amount=${event.amount} for ${invoices[0].invoiceNo}: ${outcome}`,
      );

      if (outcome === InvoiceStatus.PAID) {
        await this.notificationsService.create({
          userId: invoices[0].customerId,
          title: 'Thanh toán hóa đơn thành công',
          body: `Hóa đơn ${invoices[0].invoiceNo} đã được thanh toán thành công số tiền ${Number(event.amount).toLocaleString('vi-VN')} VND. Cảm ơn Quý khách!`,
          type: 'INVOICE_PAID',
          data: {
            invoiceId: invoices[0].id,
            invoiceNo: invoices[0].invoiceNo,
            amount: event.amount,
          },
        });
      }
    } catch (err) {
      // The partial unique index on provider_ref caught a concurrent duplicate delivery.
      if (!isUniqueViolation(err)) throw err;
      this.logger.log(`Payment sepayId=${event.sepayId} already recorded, skipping`);
    }
  }
}
