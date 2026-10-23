jest.mock('@nestjs/event-emitter', () => ({ OnEvent: () => () => undefined }));

import { Invoice } from '@entities/invoice.entity';
import { Payment } from '@entities/payment.entity';
import type { PaymentReceivedEvent } from '@modules/payments/types/payment';
import { Logger } from '@nestjs/common';
import {
  InvoiceKind,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from '@storage/types';
import { FirstRentPaymentListener } from './first-rent-payment.listener';

const INVOICE_NO = 'INV-1790760804609-6618';

const transfer = (over: Partial<PaymentReceivedEvent> = {}): PaymentReceivedEvent => ({
  sepayId: 42,
  amount: 1500000,
  content: `MBVCB.1 ${INVOICE_NO.replace(/-/g, '')} thanh toan`,
  code: null,
  referenceCode: null,
  transactionDate: '2026-10-12 10:32:00',
  gateway: 'MBBank',
  ...over,
});

describe('FirstRentPaymentListener', () => {
  let invoice: Partial<Invoice>;
  let paidBefore: number;
  let recorded: boolean;
  /** A payment staff already recorded by hand with the transfer's bank reference. */
  let handRecorded: Record<string, unknown> | null;
  let em: Record<string, jest.Mock>;
  let listener: FirstRentPaymentListener;

  beforeEach(() => {
    invoice = {
      id: 'inv-1',
      invoiceNo: INVOICE_NO,
      customerId: 'customer-1',
      status: InvoiceStatus.ISSUED,
      total: 1500000,
    };
    paidBefore = 0;
    recorded = false;
    handRecorded = null;
    em = {
      query: jest.fn(async (sql: string) =>
        sql.includes('FROM "payments"') && handRecorded ? [handRecorded] : [],
      ),
      findOne: jest.fn(async () => invoice),
      save: jest.fn(async (_entity, data) => data),
      update: jest.fn(async () => ({ affected: 1 })),
      getRepository: jest.fn(() => ({
        exists: jest.fn(async () => recorded),
        // The sum already includes the payment this delivery just saved.
        sum: jest.fn(async () => paidBefore + Number(em.save.mock.calls.at(-1)?.[1]?.amount ?? 0)),
      })),
    };
    const dataSource = {
      transaction: jest.fn((cb: (e: unknown) => unknown) => cb(em)),
      getRepository: jest.fn(() => ({
        find: jest.fn(async ({ where }) =>
          JSON.stringify(where.invoiceNo).includes(INVOICE_NO) ? [invoice] : [],
        ),
      })),
    };
    const notificationsService = {
      createForUsers: jest.fn().mockResolvedValue(1),
    };
    listener = new FirstRentPaymentListener(dataSource as never, notificationsService as never);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('records the transfer and settles the invoice it names', async () => {
    await listener.handlePaymentReceived(transfer());

    expect(em.save).toHaveBeenCalledWith(Payment, {
      paymentNo: expect.stringMatching(/^PAY-/),
      invoiceId: 'inv-1',
      customerId: 'customer-1',
      type: PaymentType.RENT,
      method: PaymentMethod.BANK_TRANSFER,
      status: PaymentStatus.SUCCEEDED,
      amount: 1500000,
      providerRef: '42',
      paidAt: new Date('2026-10-12 10:32:00'),
      metadata: {},
    });
    expect(em.update).toHaveBeenCalledWith(
      Invoice,
      { id: 'inv-1' },
      { status: InvoiceStatus.PAID },
    );
  });

  it('keeps the bank reference so it cannot be recorded again by hand', async () => {
    await listener.handlePaymentReceived(transfer({ referenceCode: 'FT2610201234' }));

    expect(em.save).toHaveBeenCalledWith(
      Payment,
      expect.objectContaining({ metadata: { referenceCode: 'FT2610201234' } }),
    );
  });

  it('links a transfer staff already recorded by hand instead of counting it twice', async () => {
    handRecorded = { id: 'pay-manual', invoiceId: 'inv-1', amount: '1500000.00' };

    await listener.handlePaymentReceived(transfer({ referenceCode: 'ft 2610201234' }));

    expect(em.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), [
      'payment-ref:FT2610201234',
    ]);
    expect(em.save).not.toHaveBeenCalled();
    expect(em.update).not.toHaveBeenCalled();
    expect(em.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE "payments"'), [
      'pay-manual',
      '42',
      JSON.stringify({ referenceCode: 'ft 2610201234' }),
    ]);
  });

  it('flags a hand-recorded transfer the bank reports with another amount', async () => {
    handRecorded = { id: 'pay-manual', invoiceId: 'inv-1', amount: '1000000.00' };

    await listener.handlePaymentReceived(transfer({ referenceCode: 'FT2610201234' }));

    expect(em.save).not.toHaveBeenCalled();
    expect(em.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE "payments"'), [
      'pay-manual',
      '42',
      JSON.stringify({
        referenceCode: 'FT2610201234',
        needsReview: `ghi tay 1000000, SePay báo 1500000 cho ${INVOICE_NO}`,
      }),
    ]);
  });

  it('still settles the invoice a transfer names when staff put it on another, flagging both', async () => {
    handRecorded = {
      id: 'pay-manual',
      invoiceId: 'inv-other',
      invoiceNo: 'INV-1790760804609-0001',
      amount: '1500000.00',
    };

    await listener.handlePaymentReceived(transfer({ referenceCode: 'FT2610201234' }));

    expect(em.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE "payments"'), [
      'pay-manual',
      null,
      JSON.stringify({
        needsReview: `trùng mã giao dịch với chuyển khoản SePay cho ${INVOICE_NO}`,
      }),
    ]);
    expect(em.save).toHaveBeenCalledWith(
      Payment,
      expect.objectContaining({
        invoiceId: 'inv-1',
        providerRef: '42',
        metadata: {
          needsReview: 'trùng mã giao dịch với khoản ghi tay trên INV-1790760804609-0001',
          referenceCode: 'FT2610201234',
        },
      }),
    );
    expect(em.update).toHaveBeenCalledWith(
      Invoice,
      { id: 'inv-1' },
      { status: InvoiceStatus.PAID },
    );
  });

  it('records a transfer for a settlement invoice as a fee', async () => {
    invoice.kind = InvoiceKind.SETTLEMENT;

    await listener.handlePaymentReceived(transfer());

    expect(em.save).toHaveBeenCalledWith(
      Payment,
      expect.objectContaining({ type: PaymentType.FEE, invoiceId: 'inv-1' }),
    );
    expect(em.update).toHaveBeenCalledWith(
      Invoice,
      { id: 'inv-1' },
      { status: InvoiceStatus.PAID },
    );
  });

  it('keeps a short transfer as partly paid until the rest arrives', async () => {
    await listener.handlePaymentReceived(transfer({ amount: 500000 }));

    expect(em.update).toHaveBeenCalledWith(
      Invoice,
      { id: 'inv-1' },
      { status: InvoiceStatus.PARTIALLY_PAID },
    );
  });

  it('completes the invoice with a top-up', async () => {
    invoice.status = InvoiceStatus.PARTIALLY_PAID;
    paidBefore = 500000;

    await listener.handlePaymentReceived(transfer({ amount: 1000000 }));

    expect(em.update).toHaveBeenCalledWith(
      Invoice,
      { id: 'inv-1' },
      { status: InvoiceStatus.PAID },
    );
  });

  it('keeps money sent to a void invoice for review without touching it', async () => {
    invoice.status = InvoiceStatus.VOID;

    await listener.handlePaymentReceived(transfer());

    expect(em.save).toHaveBeenCalledWith(
      Payment,
      expect.objectContaining({ metadata: { needsReview: 'invoice VOID' } }),
    );
    expect(em.update).not.toHaveBeenCalled();
  });

  it('ignores a delivery it already recorded', async () => {
    recorded = true;

    await listener.handlePaymentReceived(transfer());

    expect(em.save).not.toHaveBeenCalled();
  });

  it('ignores transfers without an invoice number, such as deposits', async () => {
    await listener.handlePaymentReceived(transfer({ content: 'BK-1790760804609-6618' }));
    await listener.handlePaymentReceived(transfer({ content: 'INV-1790760804609-0000' }));

    expect(em.save).not.toHaveBeenCalled();
  });
});
