jest.mock('@nestjs/event-emitter', () => ({ OnEvent: () => () => undefined }));
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_MINUTE: '* * * * *' },
}));

import { Booking } from '@entities/booking.entity';
import { Payment } from '@entities/payment.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitHold } from '@entities/unit-hold.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import type { PaymentReceivedEvent } from '@modules/payments/types/payment';
import { HttpStatus, Logger } from '@nestjs/common';
import {
  BookingStatus,
  HoldStatus,
  PaymentStatus,
  PaymentType,
  StorageUnitStatus,
} from '@storage/types';
import { In } from 'typeorm';
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
  let em: {
    findOne: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
    save: jest.Mock;
    getRepository: jest.Mock;
  };
  let paymentRepo: { exists: jest.Mock; sum: jest.Mock; save: jest.Mock };
  let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };
  let service: BookingsService;
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    bookingRepo = { find: jest.fn() };
    paymentRepo = {
      exists: jest.fn().mockResolvedValue(false),
      sum: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue({}),
    };
    em = {
      findOne: jest.fn().mockResolvedValue(buildBooking()),
      update: jest.fn(),
      count: jest.fn(),
      save: jest.fn(),
      getRepository: jest.fn(() => paymentRepo),
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
      {} as never,
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

    // The receipt was attempted inside the confirming transaction and rolled back…
    expect(em.save).toHaveBeenCalledWith(Payment, expect.objectContaining({ providerRef: '42' }));
    // …but the money still reached the bank, so a receipt is re-recorded for reconciliation.
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

    expect(dataSource.transaction).toHaveBeenCalled();
    // Receipt is committed inside the locked transaction — no out-of-tx rewrite needed.
    expect(em.save).toHaveBeenCalledWith(
      Payment,
      expect.objectContaining({ amount: 500_000, providerRef: '42' }),
    );
    expect(paymentRepo.save).not.toHaveBeenCalled();
    expect(em.update).not.toHaveBeenCalledWith(
      Booking,
      expect.anything(),
      expect.objectContaining({ status: BookingStatus.CONFIRMED }),
    );
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
    expect(paymentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ providerRef: '42' }));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('status changed concurrently'));
  });

  it('keeps the receipt when the booking is no longer awaiting deposit under the lock', async () => {
    bookingRepo.find.mockResolvedValue([buildBooking()]);
    em.findOne.mockResolvedValue(buildBooking({ status: BookingStatus.CONFIRMED }));

    await service.handlePaymentReceived(buildEvent());

    expect(em.save).not.toHaveBeenCalled();
    expect(em.update).not.toHaveBeenCalled();
    expect(paymentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ providerRef: '42' }));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('status changed concurrently'));
  });

  it('treats a unique-violation on provider_ref as a duplicate delivery', async () => {
    bookingRepo.find.mockResolvedValue([buildBooking()]);
    em.save.mockRejectedValue({ code: '23505' }); // raced past the exists() check

    await service.handlePaymentReceived(buildEvent());

    expect(paymentRepo.save).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('already recorded'));
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('BookingsService.cancel', () => {
  let bookingRepo: { findOne: jest.Mock };
  let em: {
    findOne: jest.Mock;
    update: jest.Mock;
    getRepository: jest.Mock;
  };
  let unitHoldQb: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    returning: jest.Mock;
    execute: jest.Mock;
  };
  let paymentRepo: { sum: jest.Mock };
  let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };
  let service: BookingsService;
  let warnSpy: jest.SpyInstance;

  const user = { id: 'customer-1' } as AuthUser;

  beforeEach(() => {
    bookingRepo = { findOne: jest.fn() };
    paymentRepo = { sum: jest.fn().mockResolvedValue(null) };
    unitHoldQb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ raw: [] }),
    };
    em = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      getRepository: jest.fn((entity: unknown) =>
        entity === Payment ? paymentRepo : { createQueryBuilder: () => unitHoldQb },
      ),
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
      {} as never,
    );
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('cancels a holding booking — releases holds and frees the units', async () => {
    bookingRepo.findOne.mockResolvedValue(buildBooking());
    em.findOne.mockResolvedValue(buildBooking());
    unitHoldQb.execute.mockResolvedValue({
      raw: [{ storage_unit_id: 'unit-1' }, { storage_unit_id: 'unit-2' }],
    });

    const res = await service.cancel('booking-1', user);

    expect(res.message).toBe('Đã hủy booking và giải phóng chỗ giữ');
    expect(em.update).toHaveBeenNthCalledWith(
      1,
      Booking,
      { id: 'booking-1' },
      { status: BookingStatus.CANCELLED },
    );
    expect(unitHoldQb.set).toHaveBeenCalledWith({
      status: HoldStatus.RELEASED,
      releasedAt: expect.any(Date),
    });
    expect(em.update).toHaveBeenNthCalledWith(
      2,
      StorageUnit,
      { id: In(['unit-1', 'unit-2']), status: StorageUnitStatus.HELD },
      { status: StorageUnitStatus.AVAILABLE },
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('is idempotent — a retry on an already-cancelled booking succeeds without touching anything', async () => {
    bookingRepo.findOne.mockResolvedValue(buildBooking({ status: BookingStatus.CANCELLED }));
    em.findOne.mockResolvedValue(buildBooking({ status: BookingStatus.CANCELLED }));

    const res = await service.cancel('booking-1', user);

    expect(res.message).toBe('Booking đã được hủy trước đó');
    expect(em.update).not.toHaveBeenCalled();
  });

  it('rejects cancelling a CONFIRMED booking — deposit refund needs staff', async () => {
    bookingRepo.findOne.mockResolvedValue(buildBooking({ status: BookingStatus.CONFIRMED }));
    em.findOne.mockResolvedValue(buildBooking({ status: BookingStatus.CONFIRMED }));

    await expect(service.cancel('booking-1', user)).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: expect.objectContaining({ code: 'BOOKING_NOT_CANCELLABLE' }),
    });
    expect(em.update).not.toHaveBeenCalled();
  });

  it('warns for manual reconciliation when the customer already paid', async () => {
    bookingRepo.findOne.mockResolvedValue(buildBooking());
    em.findOne.mockResolvedValue(buildBooking());
    paymentRepo.sum.mockResolvedValue('500000');

    await service.cancel('booking-1', user);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('manual reconciliation needed'));
  });

  it('rejects a booking owned by someone else', async () => {
    bookingRepo.findOne.mockResolvedValue(buildBooking({ customerId: 'other-customer' }));

    await expect(service.cancel('booking-1', user)).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
