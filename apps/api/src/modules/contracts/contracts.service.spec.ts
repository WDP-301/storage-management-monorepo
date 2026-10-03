import { Booking } from '@modules/bookings/entities/booking.entity';
import { BookingItem } from '@modules/bookings/entities/booking-item.entity';
import { AppUser } from '@modules/customer/entities/app-user.entity';
import { BookingStatus, ContractKind, ContractStatus } from '@storage/types';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ContractsService } from './contracts.service';
import { Contract } from './entities/contract.entity';

describe('ContractsService', () => {
  const item = {
    id: 'item-1',
    bookingId: 'booking-1',
    rentalMonths: 6,
    monthlyPriceSnapshot: '1000000.00',
    requestedStartAt: new Date('2026-10-01'),
    createdAt: new Date('2026-12-01T00:00:00+07:00'),
  };
  let booking: { id: string; customerId: string; status: BookingStatus; subtotal: string };
  let service: ContractsService;
  let manager: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let repo: { find: jest.Mock; findOne: jest.Mock; update: jest.Mock; softDelete: jest.Mock };

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-12-02T00:00:00+07:00').getTime());
    // Includes another item's rent: the whole subtotal must not become this contract's rent.
    booking = {
      id: 'booking-1',
      customerId: 'customer-1',
      status: BookingStatus.CONFIRMED,
      subtotal: '18000000.00',
    };
    manager = {
      findOne: jest.fn(async (entity) => {
        if (entity === BookingItem) return item;
        if (entity === Booking) return booking;
        if (entity === AppUser)
          return { id: 'customer-1', fullName: 'Customer', email: 'c@example.com' };
        return null;
      }),
      create: jest.fn((_entity, data) => data),
      save: jest.fn(async (_entity, data) => ({ id: 'contract-1', ...data })),
    };
    repo = { find: jest.fn(), findOne: jest.fn(), update: jest.fn(), softDelete: jest.fn() };
    service = new ContractsService(
      repo as unknown as Repository<Contract>,
      {
        transaction: jest.fn((callback) => callback(manager)),
      } as unknown as DataSource,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('allows creation one millisecond before the 7-day deadline', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-12-08T00:00:00+07:00').getTime() - 1);
    await expect(service.create({ bookingItemId: item.id })).resolves.toHaveProperty('id');
  });

  it.each(['2026-12-08T00:00:00+07:00', '2026-12-09T00:00:00+07:00'])(
    'rejects creation at or after the deadline: %s',
    async (now) => {
      jest.spyOn(Date, 'now').mockReturnValue(new Date(now).getTime());
      await expect(service.create({ bookingItemId: item.id })).rejects.toMatchObject({
        status: 409,
        response: {
          code: 'BOOKING_ITEM_CONTRACT_WINDOW_EXPIRED',
          details: {
            bookingItemId: item.id,
            createdAt: item.createdAt.toISOString(),
            expiresAt: new Date('2026-12-08T00:00:00+07:00').toISOString(),
          },
        },
      });
      expect(manager.save).not.toHaveBeenCalled();
    },
  );

  it.each(Object.values(BookingStatus).filter((status) => status !== BookingStatus.CONFIRMED))(
    'rejects %s bookings with the domain conflict code',
    async (status) => {
      booking.status = status;
      await expect(service.create({ bookingItemId: item.id })).rejects.toMatchObject({
        status: 409,
        response: {
          code: 'BOOKING_NOT_CONFIRMED',
          details: { status, requiredStatus: 'CONFIRMED' },
        },
      });
      expect(manager.save).not.toHaveBeenCalled();
    },
  );

  it('copies item monthly rent and months, derives the customer, and omits rentTotal', async () => {
    const result = await service.create({ bookingItemId: item.id });
    expect(result).toMatchObject({
      bookingItemId: item.id,
      customerId: booking.customerId,
      months: 6,
      monthlyPriceSnapshot: '1000000.00',
      effectiveAt: item.requestedStartAt,
      kind: ContractKind.INITIAL,
      status: ContractStatus.DRAFT,
      customerSnapshot: { id: booking.customerId, email: 'c@example.com' },
    });
    expect(result).not.toHaveProperty('rentTotal');
    expect(result.contractNo.length).toBeLessThanOrEqual(40);
    expect(manager.findOne).toHaveBeenCalledWith(
      Booking,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
  });

  it('returns 404 for a missing booking item', async () => {
    manager.findOne.mockResolvedValueOnce(null);
    await expect(service.create({ bookingItemId: 'missing' })).rejects.toMatchObject({
      status: 404,
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
  });

  it('rejects an end date preceding the effective date', async () => {
    await expect(
      service.create({ bookingItemId: item.id, endedAt: '2026-09-01' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('excludes soft-deleted contracts from reads', async () => {
    repo.find.mockResolvedValue([]);
    await expect(service.findAll()).resolves.toEqual([]);
    expect(repo.find).toHaveBeenCalledWith({
      where: { deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    repo.findOne.mockResolvedValue(null);
    await expect(service.findById('deleted')).rejects.toMatchObject({ status: 404 });
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'deleted', deletedAt: IsNull() } });
  });

  it('updates normal contract fields without changing booking/customer links', async () => {
    repo.findOne.mockResolvedValue({ id: 'contract-1', effectiveAt: item.requestedStartAt });
    repo.update.mockResolvedValue({ affected: 1 });
    await service.update('contract-1', { status: ContractStatus.ACTIVE, months: 12 });
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'contract-1', deletedAt: IsNull() },
      { status: ContractStatus.ACTIVE, months: 12 },
    );
  });

  it('soft-deletes only live records and returns 404 when already deleted', async () => {
    repo.softDelete.mockResolvedValueOnce({ affected: 1 }).mockResolvedValueOnce({ affected: 0 });
    await service.softDelete('contract-1');
    expect(repo.softDelete).toHaveBeenCalledWith({ id: 'contract-1', deletedAt: IsNull() });
    await expect(service.softDelete('contract-1')).rejects.toMatchObject({ status: 404 });
  });
});
