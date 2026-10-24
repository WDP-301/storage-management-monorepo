import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { Invoice } from '@entities/invoice.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitHold } from '@entities/unit-hold.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Logger } from '@nestjs/common';
import { fromVietnamDate, vietnamToday } from '@shared/utils/calendar.util';
import {
  ContractStatus,
  InspectionType,
  InvoiceStatus,
  NotificationType,
  StorageUnitStatus,
  UserRole,
} from '@storage/types';
import { In } from 'typeorm';
import { InspectionLifecycleService } from './inspection-lifecycle.service';

const actor = (id: string, roles: UserRole[] = [UserRole.FACILITY_STAFF]): AuthUser =>
  ({ id, roles }) as AuthUser;

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

const buildInspection = (overrides: Partial<Inspection> = {}): Inspection =>
  ({
    id: 'insp-1',
    contractId: 'contract-1',
    type: InspectionType.PRE_HANDOVER,
    inspectedBy: 'staff-1',
    evidence: [],
    damages: [],
    createdAt: daysAgo(10),
    scheduledAt: daysAgo(3),
    ...overrides,
  }) as Inspection;

const buildReturn = (overrides: Partial<Inspection> = {}) =>
  buildInspection({ type: InspectionType.RETURN, ...overrides });

const buildContract = (overrides: Partial<Contract> = {}): Contract =>
  ({
    id: 'contract-1',
    contractNo: 'CT-1',
    bookingItemId: 'item-1',
    status: ContractStatus.DRAFT,
    documents: [{ fileKey: 'uploads/1-a.pdf', name: 'a.pdf', mimeType: 'application/pdf' }],
    bookingItem: { storageUnit: { facilityId: 'facility-1' } },
    ...overrides,
  }) as unknown as Contract;

describe('InspectionLifecycleService.finalize', () => {
  let em: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    update: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    query: jest.Mock;
    transaction: jest.Mock;
  };
  let notifications: { createForUsers: jest.Mock };
  let queue: { send: jest.Mock };
  /** Whether the finalize transaction has committed. */
  let committed: boolean;
  let service: InspectionLifecycleService;
  /** Claims on the unit by other bookings — none unless a test sets them. */
  let otherHold: { bookingId: string } | null;
  let otherContract: { id: string } | null;
  /** The first-month invoice; paid unless a test says otherwise. */
  let firstRent: { id: string; status: InvoiceStatus; months: number } | null;

  const stubRows = (inspection: Inspection, contract: Contract | null = buildContract()) => {
    em.findOne.mockImplementation(async (entity, { where }) => {
      if (entity === Inspection) return inspection;
      // By id: the contract under inspection; otherwise the guard looking for another claim.
      if (entity === Contract) return where.id ? contract : otherContract;
      if (entity === UnitHold) return otherHold;
      if (entity === Invoice) return firstRent;
      if (entity === StorageUnit) return { id: 'unit-1', status: StorageUnitStatus.AVAILABLE };
      return null;
    });
  };

  beforeEach(() => {
    otherHold = null;
    otherContract = null;
    firstRent = { id: 'inv-1', status: InvoiceStatus.PAID, months: 1 };
    em = {
      // Manager-1 manages facility-1 only.
      find: jest.fn(async (_entity, { where }) =>
        where.userId === 'manager-1'
          ? [{ facilityId: 'facility-1', startsAt: new Date('2024-01-01T00:00:00Z'), endsAt: null }]
          : [],
      ),
      findOne: jest.fn(),
      findOneOrFail: jest.fn().mockResolvedValue({ id: 'item-1', storageUnitId: 'unit-1' }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn(async (entity, data) =>
        entity === Invoice ? { ...data, id: `new-${data.periodNo}` } : data,
      ),
      create: jest.fn((_entity, data) => ({ ...data })),
      // Invoice voids return no rows; the contract's ledger deposit already exists.
      query: jest.fn(async (sql: string) =>
        sql.startsWith('UPDATE invoices') ? [[], 0] : [{ id: 'deposit-1' }],
      ),
      transaction: jest.fn((cb: (e: unknown) => unknown) => cb(em)),
    };
    notifications = { createForUsers: jest.fn().mockResolvedValue(1) };
    committed = false;
    queue = { send: jest.fn(async () => (committed ? 'job-1' : 'sent before commit')) };
    const dataSource = {
      transaction: jest.fn(async (cb: (e: unknown) => unknown) => {
        const result = await cb(em);
        committed = true;
        return result;
      }),
    };
    service = new InspectionLifecycleService(
      dataSource as never,
      notifications as never,
      queue as never,
    );
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('activates the contract, rents the unit and stamps the inspection', async () => {
    stubRows(buildInspection());

    const result = await service.finalize('insp-1', actor('staff-1'));

    expect(em.findOneOrFail).toHaveBeenCalledWith(BookingItem, { where: { id: 'item-1' } });
    expect(em.update).toHaveBeenCalledWith(
      StorageUnit,
      { id: 'unit-1', status: In([StorageUnitStatus.BOOKED, StorageUnitStatus.HELD]) },
      { status: StorageUnitStatus.RENTED },
    );
    expect(em.update).toHaveBeenCalledWith(
      Contract,
      { id: 'contract-1' },
      { status: ContractStatus.ACTIVE, signedAt: expect.any(Date) },
    );
    expect(result.finalizedAt).toBeInstanceOf(Date);
    expect(result.inspectedAt).toBe(result.finalizedAt);
    // Nothing of a return happens on a handover.
    expect(result.returnedOn).toBeUndefined();
    expect(em.query).not.toHaveBeenCalled();
    expect(notifications.createForUsers).not.toHaveBeenCalled();
  });

  it('refuses to finalize a handover while the contract has no signed files', async () => {
    stubRows(buildInspection(), buildContract({ documents: [] }));

    await expect(service.finalize('insp-1', actor('staff-1'))).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: {
        code: 'CONTRACT_DOCUMENTS_REQUIRED',
        message: 'Chưa có file hợp đồng đã ký — tải lên trước khi chốt biên nhận.',
        details: { contractId: 'contract-1' },
      },
    });
    expect(em.update).not.toHaveBeenCalled();
    expect(em.save).not.toHaveBeenCalled();
  });

  it.each([
    ['was never issued', null],
    ['is still unpaid', InvoiceStatus.ISSUED],
    ['is only partly paid', InvoiceStatus.PARTIALLY_PAID],
  ])('refuses to finalize a handover while the first month %s', async (_label, status) => {
    firstRent = status ? { id: 'inv-1', status, months: 1 } : null;
    stubRows(buildInspection());

    await expect(service.finalize('insp-1', actor('staff-1'))).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: {
        code: 'FIRST_RENT_UNPAID',
        details: { contractId: 'contract-1', invoiceStatus: status },
      },
    });
    expect(em.update).not.toHaveBeenCalled();
    expect(em.save).not.toHaveBeenCalled();
  });

  it('starts the paid first month on the handover day', async () => {
    stubRows(buildInspection());

    const result = await service.finalize('insp-1', actor('staff-1'));

    const endAt = new Date(result.finalizedAt as Date);
    endAt.setMonth(endAt.getMonth() + 1);
    expect(em.update).toHaveBeenCalledWith(
      Invoice,
      { id: 'inv-1' },
      { startAt: result.finalizedAt, endAt },
    );
  });

  it('does not require the first month to finalize a return', async () => {
    firstRent = null;
    stubRows(
      buildInspection({ type: InspectionType.RETURN }),
      buildContract({ status: ContractStatus.ACTIVE }),
    );

    await expect(service.finalize('insp-1', actor('staff-1'))).resolves.toEqual(
      expect.objectContaining({ finalizedAt: expect.any(Date) }),
    );
  });

  it('does not require contract files to finalize a return', async () => {
    stubRows(
      buildInspection({ type: InspectionType.RETURN }),
      buildContract({ status: ContractStatus.ACTIVE, documents: [] }),
    );

    await expect(service.finalize('insp-1', actor('staff-1'))).resolves.toEqual(
      expect.objectContaining({ finalizedAt: expect.any(Date) }),
    );
  });

  it('keeps an inspectedAt the inspector already recorded', async () => {
    const inspectedAt = new Date('2026-10-12T09:00:00Z');
    stubRows(buildInspection({ inspectedAt }));

    const result = await service.finalize('insp-1', actor('staff-1'));

    expect(result.inspectedAt).toBe(inspectedAt);
  });

  it('lets a facility manager finalize on behalf of the assignee', async () => {
    stubRows(buildInspection());

    await expect(
      service.finalize('insp-1', actor('manager-1', [UserRole.FACILITY_MANAGER])),
    ).resolves.toEqual(expect.objectContaining({ finalizedAt: expect.any(Date) }));
  });

  it('rejects staff who are not the assignee', async () => {
    stubRows(buildInspection());

    await expect(service.finalize('insp-1', actor('staff-2'))).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
    expect(em.update).not.toHaveBeenCalled();
  });

  it('rejects a second finalize', async () => {
    stubRows(buildInspection({ finalizedAt: new Date('2026-10-12T09:00:00Z') }));

    await expect(service.finalize('insp-1', actor('staff-1'))).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
    });
    expect(em.update).not.toHaveBeenCalled();
  });

  it('requires an assigned inspector', async () => {
    stubRows(buildInspection({ inspectedBy: undefined }));

    await expect(
      service.finalize('insp-1', actor('manager-1', [UserRole.FACILITY_MANAGER])),
    ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
  });

  it('ends the contract and frees the unit on a clean return', async () => {
    stubRows(
      buildInspection({ type: InspectionType.RETURN }),
      buildContract({ status: ContractStatus.ACTIVE }),
    );

    await service.finalize('insp-1', actor('staff-1'));

    expect(em.update).toHaveBeenCalledWith(
      StorageUnit,
      { id: 'unit-1', status: In([StorageUnitStatus.RENTED]) },
      { status: StorageUnitStatus.AVAILABLE },
    );
    expect(em.update).toHaveBeenCalledWith(
      Contract,
      { id: 'contract-1' },
      { status: ContractStatus.ENDED, endedAt: expect.any(Date) },
    );
  });

  it.each([
    ['major damage', [{ description: 'Móp cửa', severity: 'MAJOR' }]],
    [
      'major and minor damage',
      [
        { description: 'Trầy sơn', severity: 'MINOR' },
        { description: 'Móp cửa', severity: 'MAJOR' },
      ],
    ],
  ])('sends a unit with %s to maintenance on return', async (_label, damages) => {
    stubRows(buildReturn({ damages }), buildContract({ status: ContractStatus.ACTIVE }));

    await service.finalize('insp-1', actor('staff-1'));

    expect(em.update).toHaveBeenCalledWith(StorageUnit, expect.anything(), {
      status: StorageUnitStatus.MAINTENANCE,
    });
  });

  it('rents a unit with only minor damage out again', async () => {
    stubRows(
      buildReturn({ damages: [{ description: 'Trầy sơn', severity: 'MINOR' }] }),
      buildContract({ status: ContractStatus.ACTIVE }),
    );

    await service.finalize('insp-1', actor('staff-1'));

    expect(em.update).toHaveBeenCalledWith(StorageUnit, expect.anything(), {
      status: StorageUnitStatus.AVAILABLE,
    });
  });

  it('records today as the return day when none is given, as older clients do', async () => {
    stubRows(buildReturn(), buildContract({ status: ContractStatus.ACTIVE, customerId: 'cust-1' }));

    const result = await service.finalize('insp-1', actor('staff-1'));

    expect(result.returnedOn).toBe(vietnamToday());
    // Came back after the appointment: rent counts to the return day.
    const voidCall = em.query.mock.calls.find(([sql]) => sql.startsWith('UPDATE invoices'));
    expect(voidCall?.[1]).toEqual(
      expect.arrayContaining(['contract-1', fromVietnamDate(vietnamToday())]),
    );
    expect(notifications.createForUsers).toHaveBeenCalledWith(
      em,
      ['cust-1'],
      expect.objectContaining({ type: NotificationType.RETURN_FINALIZED }),
    );
  });

  it('records the finalize day and voids rent from it, not from a later appointment', async () => {
    const scheduledAt = new Date(Date.now() + 5 * DAY_MS);
    stubRows(buildReturn({ scheduledAt }), buildContract({ status: ContractStatus.ACTIVE }));

    const result = await service.finalize('insp-1', actor('staff-1'));

    expect(result.returnedOn).toBe(vietnamToday());
    const voidCall = em.query.mock.calls.find(([sql]) => sql.startsWith('UPDATE invoices'));
    expect(voidCall?.[1][1]).toEqual(fromVietnamDate(vietnamToday()));
  });

  it('finalizes the return even when the deposit cannot be recorded', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    em.transaction.mockRejectedValue(new Error('could not serialize access'));
    stubRows(buildReturn(), buildContract({ status: ContractStatus.ACTIVE }));

    await expect(service.finalize('insp-1', actor('staff-1'))).resolves.toEqual(
      expect.objectContaining({ finalizedAt: expect.any(Date) }),
    );
  });

  it('does not return the customer’s refund account to staff', async () => {
    stubRows(
      buildReturn({
        refundAccount: { bankBin: null, bankName: 'X', accountNo: '1234', accountName: 'LE B' },
      }),
      buildContract({ status: ContractStatus.ACTIVE }),
    );

    const result = await service.finalize('insp-1', actor('staff-1'));

    expect(result.refundAccount).toBeUndefined();
    expect(em.save).toHaveBeenCalledWith(
      Inspection,
      expect.objectContaining({ refundAccount: expect.objectContaining({ accountNo: '1234' }) }),
    );
  });

  it('rejects a return on a contract that is not ACTIVE', async () => {
    stubRows(buildInspection({ type: InspectionType.RETURN }));

    await expect(service.finalize('insp-1', actor('staff-1'))).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
    });
    expect(em.update).not.toHaveBeenCalled();
  });

  it('does not finalize MAINTENANCE inspections', async () => {
    stubRows(buildInspection({ type: InspectionType.MAINTENANCE }));

    await expect(service.finalize('insp-1', actor('staff-1'))).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
    });
  });

  it('rejects a manager of another facility', async () => {
    stubRows(buildInspection());

    await expect(
      service.finalize('insp-1', actor('manager-2', [UserRole.FACILITY_MANAGER])),
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    expect(em.update).not.toHaveBeenCalled();
  });

  it('rejects a contract that is not DRAFT', async () => {
    stubRows(buildInspection(), buildContract({ status: ContractStatus.ACTIVE }));

    await expect(service.finalize('insp-1', actor('staff-1'))).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
    });
    expect(em.update).not.toHaveBeenCalled();
  });

  it('rejects when the unit is no longer reserved, leaving the contract untouched', async () => {
    stubRows(buildInspection());
    em.update.mockResolvedValueOnce({ affected: 0 });

    await expect(service.finalize('insp-1', actor('staff-1'))).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
    });
    expect(em.update).not.toHaveBeenCalledWith(Contract, expect.anything(), expect.anything());
    expect(em.save).not.toHaveBeenCalled();
  });

  it('locks the unit before a handover moves it', async () => {
    stubRows(buildInspection());

    await service.finalize('insp-1', actor('staff-1'));

    expect(em.findOne).toHaveBeenCalledWith(StorageUnit, {
      where: { id: 'unit-1' },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it.each([
    ['holding', () => (otherHold = { bookingId: 'booking-2' })],
    ['under contract on', () => (otherContract = { id: 'contract-2' })],
  ])('refuses a handover of a unit another booking is %s', async (_label, claim) => {
    stubRows(buildInspection());
    claim();

    await expect(service.finalize('insp-1', actor('staff-1'))).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: { code: 'UNIT_NOT_AVAILABLE', details: { storageUnitId: 'unit-1' } },
    });
    expect(em.update).not.toHaveBeenCalled();
    expect(em.save).not.toHaveBeenCalled();
  });

  it('does not run the claim check on a return', async () => {
    stubRows(
      buildInspection({ type: InspectionType.RETURN }),
      buildContract({ status: ContractStatus.ACTIVE }),
    );

    await service.finalize('insp-1', actor('staff-1'));

    expect(em.findOne).not.toHaveBeenCalledWith(UnitHold, expect.anything());
  });

  it('returns 404 for an unknown inspection', async () => {
    em.findOne.mockResolvedValue(null);

    await expect(service.finalize('missing', actor('staff-1'))).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });
  });

  describe('rent still owed by a return', () => {
    // Monthly from 15/01/2027 for a year; billed through June, July unbilled.
    const billedContract = () =>
      buildContract({
        status: ContractStatus.ACTIVE,
        customerId: 'cust-1',
        effectiveAt: new Date('2027-01-15T05:00:00.000Z'),
        months: 12,
        monthlyPriceSnapshot: '1500000.00' as never,
      });
    const billed = new Set([1, 2, 3, 4, 5, 6]);

    beforeEach(() => {
      // Appointment on 01/07, finalized on 01/08: July (from 15/07) is owed but was never billed.
      jest.useFakeTimers({ now: new Date('2027-08-01T05:00:00.000Z'), doNotFake: ['nextTick'] });
      stubRows(
        buildReturn({
          createdAt: new Date('2027-06-20T03:00:00.000Z'),
          scheduledAt: new Date('2027-07-01T05:00:00.000Z'),
        }),
        billedContract(),
      );
      const stubbed = em.findOne.getMockImplementation();
      em.findOne.mockImplementation(async (entity, options) =>
        entity === Invoice
          ? billed.has(options.where.periodNo)
            ? { id: `inv-${options.where.periodNo}` }
            : null
          : stubbed?.(entity, options),
      );
    });

    afterEach(() => jest.useRealTimers());

    it('bills it while the contract is still active, then ends the contract', async () => {
      await service.finalize('insp-1', actor('staff-1'));

      const invoiceSaves = em.save.mock.calls.filter(([entity]) => entity === Invoice);
      expect(invoiceSaves.map(([, data]) => [data.periodNo, data.total])).toEqual([[7, 1500000]]);
      const issuedAt =
        em.save.mock.invocationCallOrder[
          em.save.mock.calls.findIndex(([entity]) => entity === Invoice)
        ];
      const endedAt =
        em.update.mock.invocationCallOrder[
          em.update.mock.calls.findIndex(([entity]) => entity === Contract)
        ];
      expect(issuedAt).toBeLessThan(endedAt);
      expect(em.update).toHaveBeenCalledWith(
        Contract,
        { id: 'contract-1' },
        { status: ContractStatus.ENDED, endedAt: expect.any(Date) },
      );
      expect(notifications.createForUsers).toHaveBeenCalledWith(
        em,
        ['cust-1'],
        expect.objectContaining({ type: NotificationType.INVOICE_ISSUED }),
      );
    });

    it('queues the PDF of the new invoice only once the finalize committed', async () => {
      await service.finalize('insp-1', actor('staff-1'));

      expect(queue.send).toHaveBeenCalledTimes(1);
      expect(queue.send).toHaveBeenCalledWith('invoice.render-pdf', { invoiceId: 'new-7' });
      await expect(queue.send.mock.results[0].value).resolves.toBe('job-1');
    });

    it('keeps the finalize when the PDF cannot be queued', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation();
      queue.send.mockRejectedValue(new Error('queue down'));

      await expect(service.finalize('insp-1', actor('staff-1'))).resolves.toMatchObject({
        returnedOn: '2027-08-01',
      });
    });

    it('bills nothing more when the finalize is sent again', async () => {
      await service.finalize('insp-1', actor('staff-1'));
      em.save.mockClear();
      queue.send.mockClear();

      // The first finalize committed: the inspection now reads as finalized.
      const finalized = buildReturn({ finalizedAt: new Date('2027-07-01T05:00:00.000Z') });
      const stubbed = em.findOne.getMockImplementation();
      em.findOne.mockImplementation(async (entity, options) =>
        entity === Inspection ? finalized : stubbed?.(entity, options),
      );

      await expect(service.finalize('insp-1', actor('staff-1'))).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
      expect(em.save).not.toHaveBeenCalled();
      expect(queue.send).not.toHaveBeenCalled();
    });
  });

  it('queues nothing for a handover', async () => {
    stubRows(buildInspection());

    await service.finalize('insp-1', actor('staff-1'));

    expect(queue.send).not.toHaveBeenCalled();
  });
});
