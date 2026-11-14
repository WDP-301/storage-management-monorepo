import { Invoice } from '@entities/invoice.entity';
import { Payment } from '@entities/payment.entity';
import {
  type SettleDeps,
  settleIfTopUpInvoicePaid,
} from '@modules/change-requests/change-request-settle.util';
import { HandoverAssignmentService } from '@modules/inspection/handover-assignment/handover-assignment.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { extractInvoiceNos } from '@modules/payments/invoice-no.util';
import { generatePaymentNo } from '@modules/payments/payment-no.util';
import { markSepayOutcome } from '@modules/payments/sepay-transfers.util';
import {
  lockTransferRef,
  normalizedRefSql,
  normalizeTransferRef,
} from '@modules/payments/transfer-ref.util';
import { PAYMENT_EVENTS, PaymentReceivedEvent } from '@modules/payments/types/payment';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { isUniqueViolation } from '@shared/utils/pg-error.util';
import {
  InvoiceKind,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  SepayTransferOutcome,
} from '@storage/types';
import Decimal from 'decimal.js';
import { DataSource, type EntityManager, In } from 'typeorm';
import { creditDepositTopUp, topUpBookingId } from './deposit-topup';
import { PAYABLE_INVOICE_STATUSES, sumInvoicePayments } from './first-rent.util';
import { invoicePaidNotification } from './invoice-notifications';

type HandRecordedPayment = {
  id: string;
  invoiceId: string | null;
  invoiceNo: string | null;
  amount: string;
};

/**
 * What a delivery found among hand-recorded payments carrying its bank reference: `linked` when
 * it is that payment (same invoice), otherwise the review note to record the delivery with.
 */
type HandRecordedMatch = { linked: boolean; review?: string };

/**
 * When staff already recorded this transfer by hand (same bank reference) on the invoice it
 * names, the delivery only stamps SePay's id onto that payment instead of counting the money a
 * second time; a different amount is flagged, as the bank statement is the source of truth. When
 * the hand-recorded payment sits on another invoice, the transfer still settles the invoice it
 * names — its customer must not be locked out for staff's mistake — and both payments are
 * flagged for reconciliation. Null when no hand-recorded payment carries the reference.
 */
async function matchHandRecordedTransfer(
  em: EntityManager,
  event: PaymentReceivedEvent,
  invoice: Invoice,
): Promise<HandRecordedMatch | null> {
  const bankRef = normalizeTransferRef(event.referenceCode ?? '');
  if (!bankRef) return null;
  // Same lock as the manual path, so a payment being typed in right now is either seen here or
  // refused there.
  await lockTransferRef(em, bankRef);
  const [payment]: HandRecordedPayment[] = await em.query(
    `SELECT p."id", p."invoice_id" AS "invoiceId", i."invoice_no" AS "invoiceNo", p."amount"
       FROM "payments" p LEFT JOIN "invoices" i ON i."id" = p."invoice_id"
      WHERE p."provider_ref" IS NULL AND ${normalizedRefSql(`p."metadata"->>'transferRef'`)} = $1
      ORDER BY p."created_at" LIMIT 1
      FOR UPDATE OF p`,
    [bankRef],
  );
  if (!payment) return null;

  const stamp = (id: string, providerRef: string | null, metadata: Record<string, unknown>) =>
    em.query(
      `UPDATE "payments"
          SET "provider_ref" = COALESCE($2, "provider_ref"), "metadata" = "metadata" || $3::jsonb
        WHERE "id" = $1`,
      [id, providerRef, JSON.stringify(metadata)],
    );

  if (payment.invoiceId !== invoice.id) {
    await stamp(payment.id, null, {
      needsReview: `trùng mã giao dịch với chuyển khoản SePay cho ${invoice.invoiceNo}`,
    });
    return {
      linked: false,
      review: `trùng mã giao dịch với khoản ghi tay trên ${payment.invoiceNo ?? 'hóa đơn khác'}`,
    };
  }
  const review = new Decimal(payment.amount).eq(event.amount)
    ? null
    : `ghi tay ${new Decimal(payment.amount).toFixed(0)}, SePay báo ${event.amount} cho ${invoice.invoiceNo}`;
  await stamp(payment.id, String(event.sepayId), {
    referenceCode: event.referenceCode,
    ...(review ? { needsReview: review } : {}),
  });
  return { linked: true };
}

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
    private readonly handoverAssignment: HandoverAssignmentService,
  ) {}

  private get settleDeps(): SettleDeps {
    return {
      handoverAssignment: this.handoverAssignment,
      notifications: this.notificationsService,
    };
  }

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
      if (invoices.length > 1) {
        await markSepayOutcome(this.dataSource.manager, String(event.sepayId), 'AMBIGUOUS');
      }
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
        const handRecorded = await matchHandRecordedTransfer(em, event, invoice);
        if (handRecorded?.linked) return 'recorded-by-hand';
        const payable = PAYABLE_INVOICE_STATUSES.includes(invoice.status);
        const review = [payable ? null : `invoice ${invoice.status}`, handRecorded?.review]
          .filter(Boolean)
          .join('; ');
        const topUpBooking = await topUpBookingId(em, invoice);
        await em.save(Payment, {
          paymentNo: generatePaymentNo(),
          invoiceId: invoice.id,
          bookingId: topUpBooking ?? undefined,
          customerId: invoice.customerId,
          type:
            invoice.kind === InvoiceKind.SETTLEMENT
              ? PaymentType.FEE
              : topUpBooking
                ? PaymentType.DEPOSIT
                : PaymentType.RENT,
          method: PaymentMethod.BANK_TRANSFER,
          status: PaymentStatus.SUCCEEDED,
          amount: event.amount,
          providerRef,
          paidAt: new Date(event.transactionDate),
          metadata: {
            ...(review ? { needsReview: review } : {}),
            // Kept so a later hand-recorded payment cannot reuse this transfer's bank reference.
            ...(event.referenceCode ? { referenceCode: event.referenceCode } : {}),
          },
        });
        if (!payable) return 'needs-review';

        // A top-up payment is extra deposit held even if the invoice is only part-paid.
        await creditDepositTopUp(em, topUpBooking, event.amount);

        const paid = await sumInvoicePayments(em, invoice.id);
        const status = paid.gte(invoice.total) ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
        await em.update(Invoice, { id: invoice.id }, { status });

        if (status === InvoiceStatus.PAID) {
          await this.notificationsService.createForUsers(
            em,
            [invoice.customerId],
            invoicePaidNotification(invoice, event.amount),
          );
          // A unit change's top-up being paid triggers the move's settle step (savepoint-wrapped,
          // never rolls back the payment).
          await settleIfTopUpInvoicePaid(em, invoice, this.settleDeps, null);
        }

        return status;
      });
      this.logger.log(
        `Payment sepayId=${event.sepayId} amount=${event.amount} for ${invoices[0].invoiceNo}: ${outcome}`,
      );
      const transferOutcome =
        outcome === InvoiceStatus.PAID
          ? SepayTransferOutcome.INVOICE_PAID
          : outcome === InvoiceStatus.PARTIALLY_PAID
            ? SepayTransferOutcome.INVOICE_PARTIAL
            : outcome === 'recorded-by-hand'
              ? SepayTransferOutcome.RESOLVED
              : outcome === 'needs-review'
                ? SepayTransferOutcome.NEEDS_REVIEW
                : null;
      if (transferOutcome) {
        await markSepayOutcome(this.dataSource.manager, providerRef, transferOutcome, {
          invoiceId: invoices[0].id,
        });
      }
    } catch (err) {
      // The partial unique index on provider_ref caught a concurrent duplicate delivery.
      if (!isUniqueViolation(err)) throw err;
      this.logger.log(`Payment sepayId=${event.sepayId} already recorded, skipping`);
    }
  }
}
