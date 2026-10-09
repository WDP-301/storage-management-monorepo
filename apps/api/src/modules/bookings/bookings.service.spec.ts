jest.mock('@nestjs/event-emitter', () => ({ OnEvent: () => () => undefined }));
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_MINUTE: '* * * * *' },
}));

import { AppUser } from '@entities/app-user.entity';
import { Booking } from '@entities/booking.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { Payment } from '@entities/payment.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitHold } from '@entities/unit-hold.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import type { PaymentReceivedEvent } from '@modules/payments/types/payment';
import { HttpStatus, Logger } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import {
  BookingStatus,
  ContractKind,
  ContractStatus,
  HoldStatus,
  InspectionType,
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

const buildItem = (id: string, storageUnitId: string): BookingItem =>
  ({
    id,
    bookingId: 'booking-1',
    storageUnitId,
    requestedStartAt: new Date('2026-10-20T00:00:00Z'),
    rentalMonths: 3,
    monthlyPriceSnapshot: '1500000.00',
  }) as unknown as BookingItem;

const CUSTOMER = {
  id: 'customer-1',
  fullName: 'Nguyen Van A',
  email: 'a@example.com',
  phone: '0900000000',
} as AppUser;

describe('BookingsService.handlePaymentReceived', () => {
  let bookingRepo: { find: jest.Mock };
  let em: {
    findOne: jest.Mock;
    find: jest.Mock;
    findOneOrFail: jest.Mock;
    create: jest.Mock;
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
      find: jest.fn().mockResolvedValue([]),
      findOneOrFail: jest.fn().mockResolvedValue(CUSTOMER),
      create: jest.fn((_entity, data) => ({ ...data })),
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

  it('creates a DRAFT contract + handover inspection per item and books the units', async () => {
    bookingRepo.find.mockResolvedValue([buildBooking()]);
    em.update.mockResolvedValue({ affected: 2 });
    em.count.mockResolvedValue(0);
    em.find.mockResolvedValue([buildItem('item-1', 'unit-1'), buildItem('item-2', 'unit-2')]);
    em.save.mockImplementation(async (entity, data) =>
      entity === Contract ? { id: `c-${data.bookingItemId}`, ...data } : data,
    );

    await service.handlePaymentReceived(buildEvent());

    const contracts = em.save.mock.calls.filter(([entity]) => entity === Contract);
    expect(contracts).toHaveLength(2);
    expect(contracts[0][1]).toEqual(
      expect.objectContaining({
        bookingItemId: 'item-1',
        customerId: 'customer-1',
        kind: ContractKind.INITIAL,
        status: ContractStatus.DRAFT,
        effectiveAt: new Date('2026-10-20T00:00:00Z'),
        months: 3,
        monthlyPriceSnapshot: '1500000.00',
        customerSnapshot: expect.objectContaining({ fullName: 'Nguyen Van A' }),
      }),
    );
    const inspections = em.save.mock.calls.filter(([entity]) => entity === Inspection);
    expect(inspections.map(([, data]) => data)).toEqual([
      {
        contractId: 'c-item-1',
        type: InspectionType.PRE_HANDOVER,
        scheduledAt: new Date('2026-10-20T00:00:00Z'),
      },
      {
        contractId: 'c-item-2',
        type: InspectionType.PRE_HANDOVER,
        scheduledAt: new Date('2026-10-20T00:00:00Z'),
      },
    ]);
    expect(em.update).toHaveBeenCalledWith(
      StorageUnit,
      { id: In(['unit-1', 'unit-2']), status: StorageUnitStatus.HELD },
      { status: StorageUnitStatus.BOOKED },
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/contracts=\[CT-.+, CT-.+\]/));
  });

  it('propagates a contract failure so the whole confirmation rolls back for retry', async () => {
    bookingRepo.find.mockResolvedValue([buildBooking()]);
    em.update.mockResolvedValue({ affected: 1 });
    em.count.mockResolvedValue(0);
    em.find.mockResolvedValue([buildItem('item-1', 'unit-1')]);
    em.save.mockImplementation(async (entity, data) => {
      if (entity === Inspection) throw new Error('db down');
      return { id: 'c-1', ...data };
    });

    await expect(service.handlePaymentReceived(buildEvent())).rejects.toThrow('db down');
    expect(em.update).not.toHaveBeenCalledWith(StorageUnit, expect.anything(), expect.anything());
    expect(paymentRepo.save).not.toHaveBeenCalled();
  });

  it('rolls back when not every unit moved to BOOKED — receipt kept for review', async () => {
    bookingRepo.find.mockResolvedValue([buildBooking()]);
    em.update
      .mockResolvedValueOnce({ affected: 1 }) // booking → CONFIRMED
      .mockResolvedValueOnce({ affected: 1 }) // holds → CONVERTED
      .mockResolvedValueOnce({ affected: 0 }); // units HELD → BOOKED: nothing moved
    em.count.mockResolvedValue(0);
    em.find.mockResolvedValue([buildItem('item-1', 'unit-1')]);
    em.save.mockImplementation(async (_entity, data) => ({ id: 'c-1', ...data }));

    await service.handlePaymentReceived(buildEvent());
    expect(paymentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ providerRef: '42' }));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('manual reconciliation needed'));
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('confirmed'));
  });

  it('keeps the receipt instead of 500ing when the contract insert is refused', async () => {
    bookingRepo.find.mockResolvedValue([buildBooking()]);
    em.update.mockResolvedValue({ affected: 1 });
    em.count.mockResolvedValue(0);
    em.find.mockResolvedValue([buildItem('item-1', 'unit-1')]);
    em.save.mockImplementation(async (entity, data) => {
      if (entity === Contract) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'An initial contract already exists for this booking item',
          HttpStatus.CONFLICT,
        );
      }
      return data;
    });

    await service.handlePaymentReceived(buildEvent());

    expect(paymentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ providerRef: '42' }));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('manual reconciliation needed'));
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
    expect(em.find).not.toHaveBeenCalledWith(BookingItem, expect.anything());
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
    expect(em.find).not.toHaveBeenCalledWith(BookingItem, expect.anything());
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
    expect(em.find).not.toHaveBeenCalledWith(BookingItem, expect.anything());
  });

  it('keeps the receipt when the booking is no longer awaiting deposit under the lock', async () => {
    bookingRepo.find.mockResolvedValue([buildBooking()]);
    em.findOne.mockResolvedValue(buildBooking({ status: BookingStatus.CONFIRMED }));

    await service.handlePaymentReceived(buildEvent());

    expect(em.save).not.toHaveBeenCalled();
    expect(em.update).not.toHaveBeenCalled();
    expect(paymentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ providerRef: '42' }));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('status changed concurrently'));
    expect(em.find).not.toHaveBeenCalledWith(BookingItem, expect.anything());
  });

  it('treats a unique-violation on provider_ref as a duplicate delivery', async () => {
    bookingRepo.find.mockResolvedValue([buildBooking()]);
    em.save.mockRejectedValue({ code: '23505' }); // raced past the exists() check

    await service.handlePaymentReceived(buildEvent());

    expect(paymentRepo.save).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('already recorded'));
    expect(warnSpy).not.toHaveBeenCalled();
    expect(em.find).not.toHaveBeenCalledWith(BookingItem, expect.anything());
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
