import { AppUser } from '@entities/app-user.entity';
import { Booking } from '@entities/booking.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitChangeRequest } from '@entities/unit-change-request.entity';
import {
  ChangeRequestStatus,
  ContractStatus,
  FacilityStatus,
  PaymentStatus,
  StorageUnitStatus,
} from '@storage/types';
import { settleChangeRequest } from './change-request-settle.util';

const buildRequest = (overrides: Partial<UnitChangeRequest> = {}): UnitChangeRequest =>
  ({
    id: 'req-1',
    contractId: 'contract-old',
    oldUnitId: 'unit-old',
    newUnitId: 'unit-new',
    requestedBy: 'customer-1',
    status: ChangeRequestStatus.AWAITING_PAYMENT,
    history: [],
    moveAt: new Date('2026-07-01T02:00:00Z'),
    rentDifference: 400000,
    depositDifference: 1350000,
    topupInvoiceId: undefined,
    ...overrides,
  }) as unknown as UnitChangeRequest;

describe('settleChangeRequest', () => {
  const NOW = new Date('2026-07-01T02:00:00Z');

  let request: UnitChangeRequest;
  let oldContract: {
    id: string;
    status: ContractStatus;
    customerId: string;
    bookingItemId: string;
  };
  let oldItem: Record<string, unknown>;
  let targetUnit: Record<string, unknown>;
  let depositRow: { id: string; contractId: string; amount: string; heldAmount: string } | null;
  /** Succeeded top-up money the payments sum reports; also the raw string it returns. */
  let topUpPaid: string;
  let saves: { entity: unknown; value: unknown }[];
  let updates: {
    entity: unknown;
    where: Record<string, unknown>;
    patch: Record<string, unknown>;
  }[];
  let em: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    query: jest.Mock;
  };
  let deps: {
    handoverAssignment: { assignSafely: jest.Mock };
    notifications: { createForUsers: jest.Mock };
  };
  let idSeq: Record<string, number>;

  const savedOf = (entity: unknown) =>
    saves.filter((s) => s.entity === entity).map((s) => s.value as Record<string, unknown>);
  const updateOn = (entity: unknown, id: string) =>
    updates.find((u) => u.entity === entity && u.where.id === id);

  beforeEach(() => {
    request = buildRequest();
    oldContract = {
      id: 'contract-old',
      status: ContractStatus.ACTIVE,
      customerId: 'customer-1',
      bookingItemId: 'bi-old',
    };
    oldItem = {
      id: 'bi-old',
      storageUnitId: 'unit-old',
      rentalMonths: 3,
      monthlyPriceSnapshot: '550000.00',
      depositSnapshot: '550000.00',
    };
    targetUnit = {
      id: 'unit-new',
      code: 'A-02',
      status: StorageUnitStatus.HELD,
      facilityId: 'fac-1',
      facility: { id: 'fac-1', status: FacilityStatus.ACTIVE },
    };
    depositRow = {
      id: 'dep-1',
      contractId: 'contract-old',
      amount: '550000.00',
      heldAmount: '550000.00',
    };
    topUpPaid = '0';
    saves = [];
    updates = [];
    idSeq = {};

    em = {
      find: jest.fn(async () => []),
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === UnitChangeRequest) return request;
        if (entity === Contract) return oldContract;
        if (entity === BookingItem) return oldItem;
        if (entity === StorageUnit) return targetUnit;
        return null;
      }),
      findOneOrFail: jest.fn(async (entity: unknown) =>
        entity === AppUser ? { id: 'customer-1', fullName: 'Cust', email: 'c@test.dev' } : null,
      ),
      count: jest.fn(async () => 0),
      create: jest.fn((entity: { name: string }, data: unknown) => {
        const name = entity.name.toLowerCase();
        idSeq[name] = (idSeq[name] ?? 0) + 1;
        return { id: `${name}-${idSeq[name]}`, ...(data as object) };
      }),
      save: jest.fn(async (a: unknown, b?: unknown) => {
        const v = b ?? a;
        saves.push({ entity: b ? a : null, value: v });
        return v;
      }),
      update: jest.fn(async (entity: unknown, where: unknown, patch: unknown) => {
        updates.push({
          entity,
          where: where as Record<string, unknown>,
          patch: patch as Record<string, unknown>,
        });
        return { affected: 1 };
      }),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('sum("amount")')) return [{ paid: topUpPaid }];
        if (sql.includes('FROM deposits d WHERE d.contract_id'))
          return depositRow ? [depositRow] : [];
        if (sql.includes('shelf_items')) return [];
        if (sql.includes('storage_unit_amenities')) return [];
        if (sql.includes('UPDATE "deposits"')) return [[], 1];
        return [];
      }),
    };
    deps = {
      handoverAssignment: { assignSafely: jest.fn() },
      notifications: { createForUsers: jest.fn() },
    };
  });

  it('creates the destination contract and moves the deposit row onto it', async () => {
    const result = await settleChangeRequest(em as never, 'req-1', deps as never, {
      actorId: 'manager-1',
      now: NOW,
    });

    expect(result.status).toBe(ChangeRequestStatus.AWAITING_HANDOVER);
    expect(result.newContractId).toBe('contract-1');
    expect(result.newBookingId).toBe('booking-1');
    expect(result.settledAt).toBe(NOW);

    // The destination booking, item and contract are minted and the request saved.
    expect(savedOf(Booking)).toHaveLength(1);
    expect(savedOf(BookingItem)).toHaveLength(1);
    expect(savedOf(Contract)).toHaveLength(1);
    expect(savedOf(UnitChangeRequest)).toEqual([result]);
    expect(savedOf(BookingItem)[0]).toMatchObject({
      storageUnitId: 'unit-new',
      rentalMonths: 3,
    });

    // The held unit is claimed for the destination contract.
    expect(updateOn(StorageUnit, 'unit-new')?.patch).toEqual({ status: StorageUnitStatus.BOOKED });

    // The old contract (and its deposit row) is left alone — the move is only booked.
    expect(updateOn(Contract, 'contract-old')).toBeUndefined();
    expect(em.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "deposits"'),
      expect.anything(),
    );

    // Round-robin handover assignment hangs off the new booking.
    expect(deps.handoverAssignment.assignSafely).toHaveBeenCalledWith(em, 'booking-1');
    // The customer is told the destination contract exists.
    expect(deps.notifications.createForUsers).toHaveBeenCalledWith(
      em,
      ['customer-1'],
      expect.objectContaining({ data: expect.objectContaining({ newContractId: 'contract-1' }) }),
    );
  });

  it('leaves the old contract untouched until the handover', async () => {
    await settleChangeRequest(em as never, 'req-1', deps as never, {
      actorId: 'manager-1',
      now: NOW,
    });

    expect(updateOn(Contract, 'contract-old')).toBeUndefined();
    expect(em.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "invoices"'),
      expect.anything(),
    );
  });

  it('leaves an already-settled request untouched', async () => {
    request = buildRequest({ status: ChangeRequestStatus.AWAITING_HANDOVER });

    const result = await settleChangeRequest(em as never, 'req-1', deps as never, {
      actorId: 'manager-1',
      now: NOW,
    });

    expect(result).toBe(request);
    expect(em.save).not.toHaveBeenCalled();
    expect(em.update).not.toHaveBeenCalled();
    expect(em.findOneOrFail).not.toHaveBeenCalled();
    expect(deps.handoverAssignment.assignSafely).not.toHaveBeenCalled();
  });

  it('throws a conflict when the target unit is no longer held', async () => {
    targetUnit = { ...targetUnit, status: StorageUnitStatus.BOOKED };

    await expect(
      settleChangeRequest(em as never, 'req-1', deps as never, { actorId: null }),
    ).rejects.toMatchObject({ status: 409 });
    expect(em.save).not.toHaveBeenCalled();
    expect(deps.handoverAssignment.assignSafely).not.toHaveBeenCalled();
  });

  it('credits a paid top-up into the old deposit and quotes the required deposit on the booking', async () => {
    request = buildRequest({ topupInvoiceId: 'inv-topup' });
    topUpPaid = '300000.00';

    await settleChangeRequest(em as never, 'req-1', deps as never, { actorId: null, now: NOW });

    expect(em.query).toHaveBeenCalledWith(expect.stringContaining('sum("amount")'), [
      'inv-topup',
      PaymentStatus.SUCCEEDED,
    ]);
    // The destination booking is quoted the new required deposit (550000 + 1350000).
    expect(savedOf(Booking)[0].depositTotal).toBe('1900000.00');
    // The extra money joins the deposit still held on the OLD (active) contract.
    expect(em.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE "deposits"'), [
      '300000.00',
      'dep-1',
    ]);
  });
});
