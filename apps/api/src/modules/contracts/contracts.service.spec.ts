import { AppUser } from '@entities/app-user.entity';
import { Booking } from '@entities/booking.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitHold } from '@entities/unit-hold.entity';
import { Logger } from '@nestjs/common';
import {
  BookingStatus,
  ContractKind,
  ContractStatus,
  InspectionType,
  StorageUnitKind,
  StorageUnitStatus,
} from '@storage/types';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { ContractsService } from './contracts.service';

describe('ContractsService', () => {
  const item = {
    id: 'item-1',
    bookingId: 'booking-1',
    storageUnitId: 'unit-1',
    rentalMonths: 6,
    monthlyPriceSnapshot: '1000000.00',
    requestedStartAt: new Date('2026-10-01'),
    createdAt: new Date('2026-12-01T00:00:00+07:00'),
  };
  let booking: { id: string; customerId: string; status: BookingStatus; subtotal: string };
  let unit: {
    id: string;
    status: StorageUnitStatus;
    kind?: StorageUnitKind;
    parentId?: string | null;
    parent?: unknown;
  };
  /** Claims on the unit by other bookings — none unless a test sets them. */
  let otherHold: { bookingId: string } | null;
  let otherContract: { id: string } | null;
  let service: ContractsService;
  let manager: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
    query: jest.Mock;
    transaction: jest.Mock;
  };
  let repo: { find: jest.Mock; findOne: jest.Mock; update: jest.Mock; softDelete: jest.Mock };
  const settings = { getOverduePenaltyPercent: jest.fn(async () => 100) };
  /** Read side of /contracts/mine: inspections from the repository, the rest by SQL. */
  const readSide = (inspectionRepo: unknown, query = jest.fn(async () => []), find = jest.fn()) =>
    ({
      getRepository: jest.fn(() => inspectionRepo),
      manager: { query, find: find.mockResolvedValue([]) },
    }) as unknown as DataSource;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-12-02T00:00:00+07:00').getTime());
    // Without ledger rows the deposit cannot be derived; that warning is expected here.
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    // Includes another item's rent: the whole subtotal must not become this contract's rent.
    booking = {
      id: 'booking-1',
      customerId: 'customer-1',
      status: BookingStatus.CONFIRMED,
      subtotal: '18000000.00',
    };
    unit = { id: 'unit-1', status: StorageUnitStatus.BOOKED };
    otherHold = null;
    otherContract = null;
    manager = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(async (entity) => {
        if (entity === BookingItem) return item;
        if (entity === Booking) return booking;
        if (entity === AppUser)
          return { id: 'customer-1', fullName: 'Customer', email: 'c@example.com' };
        if (entity === StorageUnit) return unit;
        if (entity === UnitHold) return otherHold;
        if (entity === Contract) return otherContract;
        return null;
      }),
      create: jest.fn((_entity, data) => data),
      save: jest.fn(async (_entity, data) => ({ id: 'contract-1', ...data })),
      findOneOrFail: jest.fn(async (entity) => (entity === Contract ? { id: 'contract-1' } : null)),
      update: jest.fn(async () => ({ affected: 1 })),
      softDelete: jest.fn(async () => ({ affected: 0 })),
      // Amenity snapshot and deposit ledger reads return no rows; UPDATE answers [rows, count].
      query: jest.fn(async (sql: string) => (sql.trimStart().startsWith('UPDATE') ? [[], 0] : [])),
      // A nested transaction is a savepoint on the same manager.
      transaction: jest.fn((callback) => callback(manager)),
    };
    repo = { find: jest.fn(), findOne: jest.fn(), update: jest.fn(), softDelete: jest.fn() };
    service = new ContractsService(
      repo as unknown as Repository<Contract>,
      {
        transaction: jest.fn((callback) => callback(manager)),
      } as unknown as DataSource,
      settings as never,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('attaches the handover and the latest return to each contract in /contracts/mine', async () => {
    const summary = (id: string, type: InspectionType, createdAt: string) => ({
      id,
      contractId: 'contract-1',
      type,
      scheduledAt: new Date('2026-10-13T00:00:00Z'),
      finalizedAt: null,
      inspector: { fullName: 'Staff A' },
      evidence: [],
      damages: [],
      createdAt: new Date(createdAt),
    });
    const inspectionRepo = {
      // Oldest first, as the service requests.
      find: jest
        .fn()
        .mockResolvedValue([
          summary('handover-1', InspectionType.PRE_HANDOVER, '2026-10-01'),
          summary('return-old', InspectionType.RETURN, '2026-11-01'),
          summary('return-new', InspectionType.RETURN, '2026-12-01'),
        ]),
    };
    service = new ContractsService(
      repo as unknown as Repository<Contract>,
      readSide(inspectionRepo),
      settings as never,
    );
    repo.find.mockResolvedValue([{ id: 'contract-1' }, { id: 'contract-2' }]);

    const [withInspections, bare] = await service.findMine('customer-1');

    expect(inspectionRepo.find).toHaveBeenCalledWith({
      where: {
        contractId: In(['contract-1', 'contract-2']),
        type: In([InspectionType.PRE_HANDOVER, InspectionType.RETURN]),
      },
      relations: { inspector: true },
      order: { createdAt: 'ASC' },
    });
    expect(withInspections.handover).toMatchObject({
      id: 'handover-1',
      scheduled_at: new Date('2026-10-13T00:00:00Z'),
      inspector_name: 'Staff A',
    });
    expect(withInspections.return).toMatchObject({ id: 'return-new' });
    expect(bare.handover).toBeNull();
    expect(bare.return).toBeNull();
  });

  it('adds the deposit, overstay charge and settlement summary in /contracts/mine', async () => {
    const inspectionRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'return-1',
          contractId: 'contract-1',
          type: InspectionType.RETURN,
          returnRules: { noticeDays: 30, penaltyPercent: 200 },
          refundAccount: {
            bankBin: null,
            bankName: 'X',
            accountNo: '0123456789',
            accountName: 'A',
          },
          evidence: [],
          damages: [],
          createdAt: new Date('2027-01-01'),
        },
      ]),
    };
    const query = jest.fn(async () => [
      {
        id: 'dep-1',
        contractId: 'contract-1',
        paymentId: null,
        amount: '2000000.00',
        heldAmount: '2000000.00',
        status: 'HELD',
      },
    ]);
    service = new ContractsService(
      repo as unknown as Repository<Contract>,
      readSide(inspectionRepo, query),
      settings as never,
    );
    repo.find.mockResolvedValue([
      {
        id: 'contract-1',
        status: ContractStatus.ENDED,
        bookingItemId: 'item-1',
        effectiveAt: new Date('2026-10-01T00:00:00+07:00'),
        months: 3,
        monthlyPriceSnapshot: '1500000.00',
      },
    ]);

    const [record] = await service.findMine('customer-1');

    expect(record).toMatchObject({
      deposit: 2000000,
      term_end_at: new Date('2027-01-01T00:00:00+07:00'),
      // 1.500.000 / 30 × 200% — the percent captured on the return request wins.
      overdue_penalty_per_day: 100000,
      settlement: {
        status: 'PENDING',
        deposit_amount: 2000000,
        refund_account: { account_no_masked: '••••6789' },
        totals: null,
      },
    });
  });

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

  it('freezes the unit amenities into the new contract, [] when it has none', async () => {
    const result = await service.create({ bookingItemId: item.id });
    expect(manager.query).toHaveBeenCalledWith(expect.any(String), ['unit-1']);
    expect(result.amenitiesSnapshot).toEqual([]);

    const amenity = { amenityId: 'a-1', code: 'CCTV', name: 'CCTV', quantity: 6, note: 'gate' };
    manager.query.mockImplementation(async (sql: string) =>
      sql.includes('storage_unit_amenities') ? [amenity] : sql.startsWith('UPDATE') ? [[], 0] : [],
    );
    const withAmenities = await service.create({ bookingItemId: item.id });
    expect(withAmenities.amenitiesSnapshot).toEqual([
      { amenityId: 'a-1', code: 'CCTV', name: 'CCTV', quantity: 6, note: 'gate' },
    ]);
  });

  it('retires a cancelled initial contract of the item before contracting it again', async () => {
    await service.create({ bookingItemId: item.id });

    expect(manager.softDelete).toHaveBeenCalledWith(Contract, {
      bookingItemId: item.id,
      kind: ContractKind.INITIAL,
      status: ContractStatus.CANCELLED,
      deletedAt: IsNull(),
    });
    const contractSave = manager.save.mock.calls.findIndex(([entity]) => entity === Contract);
    expect(manager.softDelete.mock.invocationCallOrder[0]).toBeLessThan(
      manager.save.mock.invocationCallOrder[contractSave],
    );
  });

  it('keeps cancelled contracts when the new contract is a renewal', async () => {
    await service.create({ bookingItemId: item.id, kind: ContractKind.RENEWAL });
    expect(manager.softDelete).not.toHaveBeenCalled();
  });

  it("moves the cancelled contract's held deposit to the re-created contract", async () => {
    const moved = {
      id: 'deposit-1',
      contractId: 'contract-1',
      paymentId: 'payment-1',
      amount: '2000000.00',
      heldAmount: '2000000.00',
      status: 'HELD',
    };
    manager.query.mockImplementation(async (sql: string) =>
      sql.trimStart().startsWith('UPDATE deposits') ? [[moved], 1] : [],
    );

    await service.create({ bookingItemId: item.id });

    expect(manager.transaction).toHaveBeenCalledTimes(1);
    expect(manager.query).toHaveBeenCalledWith(expect.stringMatching(/^\s*UPDATE deposits/), [
      'contract-1',
      item.id,
    ]);
    expect(manager.query).not.toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO deposits/),
      expect.anything(),
    );
  });

  it('still creates the contract when recording its deposit fails', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    manager.transaction.mockRejectedValue(new Error('deposits locked'));

    await expect(service.create({ bookingItemId: item.id })).resolves.toHaveProperty(
      'id',
      'contract-1',
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('contract-1'),
      expect.stringContaining('deposits locked'),
    );
  });

  it('locks the unit before creating the contract', async () => {
    await service.create({ bookingItemId: item.id });
    expect(manager.findOne).toHaveBeenCalledWith(StorageUnit, {
      where: { id: 'unit-1' },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it('re-claims a unit a cancelled draft put back on the market', async () => {
    unit.status = StorageUnitStatus.AVAILABLE;
    await service.create({ bookingItemId: item.id });
    expect(manager.update).toHaveBeenCalledWith(
      StorageUnit,
      { id: 'unit-1' },
      { status: StorageUnitStatus.BOOKED },
    );
  });

  it('leaves a unit already booked for this item as it is', async () => {
    await service.create({ bookingItemId: item.id });
    expect(manager.update).not.toHaveBeenCalledWith(
      StorageUnit,
      expect.anything(),
      expect.anything(),
    );
  });

  it('refuses a unit another booking is holding', async () => {
    unit.status = StorageUnitStatus.HELD;
    otherHold = { bookingId: 'booking-2' };
    await expect(service.create({ bookingItemId: item.id })).rejects.toMatchObject({
      status: 409,
      response: {
        code: 'UNIT_NOT_AVAILABLE',
        details: { storageUnitId: 'unit-1', heldByBookingId: 'booking-2', contractId: null },
      },
    });
    expect(manager.save).not.toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('refuses a unit another booking item already has a live contract on', async () => {
    otherContract = { id: 'contract-2' };
    await expect(service.create({ bookingItemId: item.id })).rejects.toMatchObject({
      status: 409,
      response: { code: 'UNIT_NOT_AVAILABLE', details: { contractId: 'contract-2' } },
    });
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('re-claims a shelf whose parent warehouse is still open', async () => {
    unit = {
      id: 'unit-1',
      status: StorageUnitStatus.AVAILABLE,
      kind: StorageUnitKind.SHELF,
      parent: { status: StorageUnitStatus.AVAILABLE },
    };
    await service.create({ bookingItemId: item.id });
    expect(manager.update).toHaveBeenCalledWith(
      StorageUnit,
      { id: 'unit-1' },
      { status: StorageUnitStatus.BOOKED },
    );
  });

  it('share-locks the parent warehouse before locking the shelf it re-claims', async () => {
    unit = {
      id: 'unit-1',
      status: StorageUnitStatus.AVAILABLE,
      kind: StorageUnitKind.SHELF,
      parentId: 'parent-1',
      parent: { status: StorageUnitStatus.AVAILABLE },
    };
    await service.create({ bookingItemId: item.id });

    expect(manager.find).toHaveBeenCalledWith(
      StorageUnit,
      expect.objectContaining({
        where: { id: In(['parent-1']) },
        lock: { mode: 'pessimistic_read' },
      }),
    );
    const unitLock = manager.findOne.mock.calls.findIndex(
      ([entity, options]) => entity === StorageUnit && options.lock,
    );
    expect(manager.find.mock.invocationCallOrder[0]).toBeLessThan(
      manager.findOne.mock.invocationCallOrder[unitLock],
    );
  });

  it('refuses to re-claim a shelf whose parent warehouse closed meanwhile', async () => {
    unit = {
      id: 'unit-1',
      status: StorageUnitStatus.AVAILABLE,
      kind: StorageUnitKind.SHELF,
      parent: { status: StorageUnitStatus.MAINTENANCE },
    };
    await expect(service.create({ bookingItemId: item.id })).rejects.toMatchObject({
      status: 409,
      response: { code: 'UNIT_NOT_AVAILABLE' },
    });
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('does not make two shelves of one warehouse conflict — claims are per shelf', async () => {
    unit = { id: 'unit-1', status: StorageUnitStatus.HELD, kind: StorageUnitKind.SHELF };
    // No claim on this shelf: a sibling shelf's hold lives on a different unit id.
    await expect(service.create({ bookingItemId: item.id })).resolves.toHaveProperty('id');
    const holdLookup = manager.findOne.mock.calls.find(([entity]) => entity === UnitHold);
    expect(holdLookup?.[1].where.storageUnitId).toBe('unit-1');
  });

  it('refuses a shelf another booking is holding', async () => {
    unit = { id: 'unit-1', status: StorageUnitStatus.HELD, kind: StorageUnitKind.SHELF };
    otherHold = { bookingId: 'booking-2' };
    await expect(service.create({ bookingItemId: item.id })).rejects.toMatchObject({
      status: 409,
      response: { code: 'UNIT_NOT_AVAILABLE', details: { heldByBookingId: 'booking-2' } },
    });
  });

  it('exposes the unit kind and shelf warehouse in /contracts/mine', async () => {
    const inspectionRepo = { find: jest.fn().mockResolvedValue([]) };
    service = new ContractsService(
      repo as unknown as Repository<Contract>,
      readSide(inspectionRepo),
      settings as never,
    );
    const stored = (kind: StorageUnitKind, parent: unknown) => ({
      id: `c-${kind}`,
      bookingItem: {
        storageUnit: {
          id: 'u',
          code: 'S1',
          name: 'Shelf 1',
          kind,
          parent,
          addressLine: 'a',
          areaM2: '1',
          widthM: '1',
          lengthM: '1',
          heightM: null,
          volumeM3: null,
          status: StorageUnitStatus.RENTED,
        },
      },
    });
    repo.find.mockResolvedValue([
      stored(StorageUnitKind.SHELF, { id: 'p', code: 'WH', name: 'Kho kệ', status: 'AVAILABLE' }),
      stored(StorageUnitKind.SELF_STORAGE, null),
    ]);

    const [shelf, selfStorage] = await service.findMine('customer-1');

    expect(shelf.unit).toMatchObject({
      kind: StorageUnitKind.SHELF,
      parent: { id: 'p', code: 'WH', name: 'Kho kệ' },
    });
    expect(selfStorage.unit).toMatchObject({ kind: StorageUnitKind.SELF_STORAGE, parent: null });
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: { bookingItem: { storageUnit: { facility: true, parent: true } } },
      }),
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
    repo.findOne.mockResolvedValue(null);
    await expect(service.findById('deleted')).rejects.toMatchObject({ status: 404 });
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'deleted', deletedAt: IsNull() } });
  });

  it('updates normal contract fields without changing booking/customer links', async () => {
    const contract = { id: 'contract-1', effectiveAt: item.requestedStartAt };
    manager.findOne.mockResolvedValue(contract);
    await service.update('contract-1', { months: 12 });
    expect(manager.findOne).toHaveBeenCalledWith(
      Contract,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(manager.update).toHaveBeenCalledWith(
      Contract,
      { id: 'contract-1', deletedAt: IsNull() },
      { months: 12 },
    );
  });

  it('moves an open handover appointment along with the effective date', async () => {
    manager.findOne.mockResolvedValue({ id: 'contract-1', effectiveAt: item.requestedStartAt });
    await service.update('contract-1', { effectiveAt: '2026-10-20T00:00:00.000Z' });
    expect(manager.update).toHaveBeenCalledWith(
      Inspection,
      { contractId: 'contract-1', type: InspectionType.PRE_HANDOVER, finalizedAt: IsNull() },
      { scheduledAt: new Date('2026-10-20T00:00:00.000Z') },
    );

    manager.update.mockClear();
    await service.update('contract-1', { months: 12 });
    expect(manager.update).not.toHaveBeenCalledWith(
      Inspection,
      expect.anything(),
      expect.anything(),
    );
  });

  it('rejects sealed fields once the contract is signed', async () => {
    manager.findOne.mockResolvedValue({
      id: 'contract-1',
      signedAt: new Date(),
      effectiveAt: item.requestedStartAt,
    });
    await expect(service.update('contract-1', { months: 12 })).rejects.toMatchObject({
      status: 409,
      response: { code: 'CONFLICT', details: { sealedFields: ['months'] } },
    });
    expect(manager.update).not.toHaveBeenCalled();
  });

  describe('softDelete', () => {
    let open: { settlement_status: string | null; open_invoices: boolean; held_deposit: boolean };
    const stored = (status: ContractStatus) => {
      manager.findOne.mockImplementation(async (entity) =>
        entity === Contract ? { id: 'contract-1', status } : null,
      );
    };
    beforeEach(() => {
      open = { settlement_status: 'COMPLETED', open_invoices: false, held_deposit: false };
      manager.query.mockImplementation(async () => [open]);
    });

    it('soft-deletes a finished contract with nothing open, under the row lock', async () => {
      stored(ContractStatus.ENDED);
      await service.softDelete('contract-1');
      expect(manager.findOne).toHaveBeenCalledWith(Contract, {
        where: { id: 'contract-1', deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      expect(manager.softDelete).toHaveBeenCalledWith(Contract, { id: 'contract-1' });
    });

    it('returns 404 when the contract is already deleted', async () => {
      manager.findOne.mockResolvedValue(null);
      await expect(service.softDelete('contract-1')).rejects.toMatchObject({ status: 404 });
    });

    it.each([ContractStatus.DRAFT, ContractStatus.ACTIVE])(
      'refuses to soft-delete a %s contract — its unit would stay booked',
      async (status) => {
        stored(status);
        await expect(service.softDelete('contract-1')).rejects.toMatchObject({
          status: 409,
          response: { code: 'CONFLICT', details: { status } },
        });
        expect(manager.softDelete).not.toHaveBeenCalled();
      },
    );

    it.each([
      [
        'an ENDED contract whose settlement is not completed',
        ContractStatus.ENDED,
        { settlement_status: 'AWAITING_REFUND' },
        'SETTLEMENT_OPEN',
      ],
      [
        'an ENDED contract never settled',
        ContractStatus.ENDED,
        { settlement_status: null },
        'SETTLEMENT_OPEN',
      ],
      [
        'a contract with an unpaid invoice',
        ContractStatus.ENDED,
        { open_invoices: true },
        'INVOICES_OPEN',
      ],
      [
        'a CANCELLED contract still holding a deposit',
        ContractStatus.CANCELLED,
        { held_deposit: true },
        'DEPOSIT_HELD',
      ],
    ])('refuses to soft-delete %s', async (_label, status, over, reason) => {
      stored(status);
      Object.assign(open, over);
      await expect(service.softDelete('contract-1')).rejects.toMatchObject({
        status: 409,
        response: { code: 'CONFLICT', details: { reason } },
      });
      expect(manager.softDelete).not.toHaveBeenCalled();
    });
  });
});
