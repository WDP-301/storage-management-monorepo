jest.mock('@nestjs/event-emitter', () => ({ OnEvent: () => () => undefined }));
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_MINUTE: '* * * * *' },
}));

import { Booking } from '@entities/booking.entity';
import { Payment } from '@entities/payment.entity';
import { UnitHold } from '@entities/unit-hold.entity';
import type { PaymentReceivedEvent } from '@modules/payments/types/payment';
import { Logger } from '@nestjs/common';
import { BookingStatus, HoldStatus, PaymentStatus, PaymentType } from '@storage/types';
import { BookingsService } from './bookings.service';

const BOOKING_NO = 'BK-1790760804609-6618';

const buildBooking = (overrides: Partial<Booking> = {}): Booking =>
  ({
    id: 'booking-1',
    bookingNo: BOOKING_NO,
    customerId: 'customer-1',
    status: BookingStatus.HOLDING,
    subtotal: '3000000.00',
    depositTotal: '1000000.00',
    items: [],
    createdAt: new Date('2026-10-04T00:00:00Z'),
    updatedAt: new Date('2026-10-04T00:00:00Z'),
    ...overrides,
  }) as Booking;

const buildEvent = (overrides: Partial<PaymentReceivedEvent> = {}): PaymentReceivedEvent => ({
  sepayId: 42,
  amount: 1_000_000,
  content: `CK ${BOOKING_NO}`,
  code: null,
  transactionDate: '2026-10-04T00:00:00Z',
  gateway: 'MB',
  ...overrides,
});

describe('BookingsService.handlePaymentReceived', () => {
  let bookingRepo: { find: jest.Mock };
  let em: { update: jest.Mock; count: jest.Mock; save: jest.Mock };
  let paymentRepo: { exists: jest.Mock; sum: jest.Mock; save: jest.Mock };
  let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };
  let service: BookingsService;
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    bookingRepo = { find: jest.fn() };
    em = { update: jest.fn(), count: jest.fn(), save: jest.fn() };
    paymentRepo = {
      exists: jest.fn().mockResolvedValue(false),
      sum: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue({}),
    };
    dataSource = {
      transaction: jest.fn((cb: (e: unknown) => unknown) => cb(em)),
      getRepository: jest.fn(() => paymentRepo),
    };
    service = new BookingsService(
      bookingRepo as never,
      {} as never,
      dataSource as never,
      { get: jest.fn() } as never,
    );
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('confirms the booking and converts its holds so the sweep cannot release them', async () => {
    bookingRepo.find.mockResolvedValue([buildBooking()]);
    em.update.mockResolvedValue({ affected: 1 });
    em.count.mockResolvedValue(0);

    await service.handlePaymentReceived(buildEvent());

    expect(em.update).toHaveBeenNthCalledWith(
      2,
      UnitHold,
      expect.objectContaining({ bookingId: 'booking-1', status: HoldStatus.ACTIVE }),
      { status: HoldStatus.CONVERTED },
    );
    expect(em.save).toHaveBeenCalledWith(
      Payment,
      expect.objectContaining({
        bookingId: 'booking-1',
        customerId: 'customer-1',
        type: PaymentType.DEPOSIT,
        status: PaymentStatus.SUCCEEDED,
        amount: 1_000_000,
        providerRef: '42',
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('confirmed via payment'));
  });

  it('rolls back when a hold already expired — late payment goes to manual reconciliation', async () => {
    bookingRepo.find.mockResolvedValue([buildBooking()]);
    em.update.mockResolvedValue({ affected: 1 });
    em.count.mockResolvedValue(1); // an ACTIVE hold remains → expired but not yet swept

    await service.handlePaymentReceived(buildEvent());

    // The confirming transaction rolled back — no receipt inside it…
    expect(em.save).not.toHaveBeenCalled();
    // …but the money still reached the bank, so a receipt is recorded for reconciliation.
    expect(paymentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ providerRef: '42' }));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('arrived after holds expired'));
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('confirmed'));
  });

  it('skips when the booking is not awaiting a deposit', async () => {
    bookingRepo.find.mockResolvedValue([buildBooking({ status: BookingStatus.CONFIRMED })]);

    await service.handlePaymentReceived(buildEvent());

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not awaiting deposit'));
  });

  it('records an underpaid transfer but keeps the booking pending', async () => {
    bookingRepo.find.mockResolvedValue([buildBooking()]);

    await service.handlePaymentReceived(buildEvent({ amount: 500_000 }));

    expect(paymentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 500_000, providerRef: '42' }),
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('< deposit'));
  });

  it('confirms once cumulative transfers cover the deposit', async () => {
    bookingRepo.find.mockResolvedValue([buildBooking()]);
    paymentRepo.sum.mockResolvedValue('500000'); // an earlier partial payment
    em.update.mockResolvedValue({ affected: 1 });
    em.count.mockResolvedValue(0);

    await service.handlePaymentReceived(buildEvent({ amount: 500_000 }));

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(em.save).toHaveBeenCalledWith(Payment, expect.objectContaining({ amount: 500_000 }));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('confirmed via payment'));
  });

  it('skips when the same SePay transfer was already recorded', async () => {
    bookingRepo.find.mockResolvedValue([buildBooking()]);
    paymentRepo.exists.mockResolvedValue(true);

    await service.handlePaymentReceived(buildEvent());

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(em.save).not.toHaveBeenCalled();
    expect(paymentRepo.save).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('already recorded'));
  });

  it('does not double-confirm but still records the losing transfer', async () => {
    bookingRepo.find.mockResolvedValue([buildBooking()]);
    em.update.mockResolvedValue({ affected: 0 }); // the atomic status guard loses the race

    await service.handlePaymentReceived(buildEvent());

    expect(em.update).toHaveBeenCalledTimes(1);
    expect(em.save).not.toHaveBeenCalled(); // rolled back before its own insert
    expect(paymentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ providerRef: '42' }));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('status changed concurrently'));
  });
});
