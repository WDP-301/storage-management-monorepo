import { PickupRequest } from '@entities/pickup-request.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { findOverdueInvoiceNos } from '@modules/access/overdue-invoices.query';
import { assertWorksAtFacility } from '@modules/access/staff-facility.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { addVietnamDays, vietnamToday } from '@shared/utils/calendar.util';
import { ContractStatus, StorageUnitKind } from '@storage/types';
import { QueryFailedError } from 'typeorm';
import { loadPickupRequests } from '../shelf-storage/pickup-request.read';
import { findShelfContracts, loadStock } from '../shelf-storage/shelf-contract.query';
import { PickupRequestsService } from './pickup-requests.service';
import { PickupRequestsStaffService } from './pickup-requests-staff.service';

jest.mock('@modules/access/overdue-invoices.query');
jest.mock('@modules/access/staff-facility.util');
jest.mock('../shelf-storage/pickup-request.read');
jest.mock('../shelf-storage/shelf-contract.query');

const customer = { id: 'cust-1' } as AuthUser;
const staff = { id: 'staff-1' } as AuthUser;
const FUTURE = () => new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();

const contractRow = (overrides = {}) => ({
  id: 'c-1',
  status: ContractStatus.ACTIVE,
  customerId: 'cust-1',
  returnOpen: false,
  facility: { id: 'fac-1' },
  ...overrides,
});
const item = (id: string, name: string, quantity: number) => ({ id, name, quantity });
const requestView = (overrides = {}) => ({
  id: 'req-1',
  contractId: 'c-1',
  status: 'PENDING',
  customer: { id: 'cust-1', fullName: 'An' },
  shelf: { code: 'K-1' },
  warehouse: { id: 'w-1' },
  requestedFor: new Date(),
  lines: [],
  ...overrides,
});

describe('pickup requests', () => {
  let em: { insert: jest.Mock; update: jest.Mock; query: jest.Mock; findOne: jest.Mock };
  let notifications: { createForUsers: jest.Mock };
  let customerService: PickupRequestsService;
  let staffService: PickupRequestsStaffService;
  let lockedStatus: string;

  const mockedContracts = jest.mocked(findShelfContracts);
  const mockedRequests = jest.mocked(loadPickupRequests);

  beforeEach(() => {
    lockedStatus = 'PENDING';
    em = {
      insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 'req-1' }] }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      query: jest.fn(async (sql: string) =>
        sql.includes('FOR UPDATE') && sql.includes('pickup_requests')
          ? [{ status: lockedStatus }]
          : [{ userId: 'staff-9' }],
      ),
      findOne: jest.fn(),
    };
    notifications = { createForUsers: jest.fn() };
    const dataSource = {
      manager: em,
      transaction: jest.fn((cb: (e: unknown) => unknown) => cb(em)),
    };
    customerService = new PickupRequestsService(dataSource as never, notifications as never);
    staffService = new PickupRequestsStaffService(dataSource as never, notifications as never);
    mockedContracts.mockResolvedValue([contractRow()] as never);
    jest.mocked(loadStock).mockResolvedValue(new Map([['c-1', [item('i-1', 'Sách', 5)] as never]]));
    mockedRequests.mockResolvedValue([requestView()] as never);
    jest.mocked(findOverdueInvoiceNos).mockResolvedValue([]);
    jest.mocked(assertWorksAtFacility).mockResolvedValue(undefined);
  });

  afterEach(() => jest.resetAllMocks());

  describe('create', () => {
    const body = (patch = {}) => ({
      lines: [{ itemId: 'i-1', quantity: 2 }],
      requestedFor: FUTURE(),
      ...patch,
    });
    /** The open-request lookup is the call with `open: true`. */
    const openRequestExists = () =>
      mockedRequests.mockImplementation(async (_em, q) =>
        q.open ? ([requestView({ id: 'open-1' })] as never) : ([requestView()] as never),
      );

    it('stores name snapshots and notifies the facility staff on the same transaction', async () => {
      mockedRequests.mockImplementation(async (_em, q) =>
        q.open ? [] : ([requestView()] as never),
      );

      const result = await customerService.create('c-1', body({ note: ' hi ' }), customer);

      expect(em.insert).toHaveBeenCalledWith(
        PickupRequest,
        expect.objectContaining({
          contractId: 'c-1',
          customerId: 'cust-1',
          note: 'hi',
          lines: [{ itemId: 'i-1', name: 'Sách', quantity: 2 }],
        }),
      );
      expect(em.query).toHaveBeenCalledWith(expect.stringContaining('user_role_assignments'), [
        'fac-1',
      ]);
      expect(notifications.createForUsers).toHaveBeenCalledWith(
        em,
        ['staff-9'],
        expect.objectContaining({ type: 'PICKUP_REQUEST_CREATED' }),
      );
      expect(result.id).toBe('req-1');
    });

    it('answers 404 for a contract that is not the caller’s', async () => {
      mockedContracts.mockResolvedValue([contractRow({ customerId: 'other' })] as never);
      await expect(customerService.create('c-1', body(), customer)).rejects.toMatchObject({
        status: 404,
      });
      mockedContracts.mockResolvedValue([]);
      await expect(customerService.create('c-1', body(), customer)).rejects.toMatchObject({
        status: 404,
      });
    });

    it('refuses an ended contract', async () => {
      mockedContracts.mockResolvedValue([contractRow({ status: ContractStatus.ENDED })] as never);
      await expect(customerService.create('c-1', body(), customer)).rejects.toMatchObject({
        response: {
          code: 'PICKUP_REQUEST_NOT_ALLOWED',
          details: { reason: 'CONTRACT_NOT_ACTIVE' },
        },
      });
    });

    it('refuses a second open request and names it', async () => {
      openRequestExists();
      await expect(customerService.create('c-1', body(), customer)).rejects.toMatchObject({
        response: { details: { reason: 'OPEN_REQUEST_EXISTS', requestId: 'open-1' } },
      });
    });

    it('refuses an empty shelf', async () => {
      mockedRequests.mockResolvedValue([]);
      jest.mocked(loadStock).mockResolvedValue(new Map([['c-1', []]]));
      await expect(customerService.create('c-1', body(), customer)).rejects.toMatchObject({
        response: { details: { reason: 'NO_STOCK' } },
      });
    });

    it('refuses while an invoice is overdue, unless the return is open', async () => {
      mockedRequests.mockResolvedValue([]);
      jest.mocked(findOverdueInvoiceNos).mockResolvedValue(['INV-1']);
      await expect(customerService.create('c-1', body(), customer)).rejects.toMatchObject({
        response: { code: 'INVOICE_OVERDUE', details: { invoiceNos: ['INV-1'] } },
      });

      mockedContracts.mockResolvedValue([contractRow({ returnOpen: true })] as never);
      mockedRequests.mockImplementation(async (_em, q) =>
        q.open ? [] : ([requestView()] as never),
      );
      await expect(customerService.create('c-1', body(), customer)).resolves.toBeDefined();
    });

    it('rejects an item that is not on the shelf', async () => {
      mockedRequests.mockResolvedValue([]);
      await expect(
        customerService.create('c-1', body({ lines: [{ itemId: 'zzz', quantity: 1 }] }), customer),
      ).rejects.toMatchObject({
        response: { details: { reason: 'ITEM_NOT_IN_CONTRACT', itemIds: ['zzz'] } },
      });
    });

    it('lists the items asked for more than is stored', async () => {
      mockedRequests.mockResolvedValue([]);
      await expect(
        customerService.create('c-1', body({ lines: [{ itemId: 'i-1', quantity: 6 }] }), customer),
      ).rejects.toMatchObject({
        response: {
          details: {
            reason: 'QUANTITY_EXCEEDS_STOCK',
            items: [{ itemId: 'i-1', name: 'Sách', requested: 6, available: 5 }],
          },
        },
      });
      expect(em.insert).not.toHaveBeenCalled();
    });

    it.each([
      ['in the past', new Date(Date.now() - 3600_000).toISOString()],
      ['over 30 days ahead', new Date(Date.now() + 31 * 24 * 3600_000).toISOString()],
    ])('rejects a time %s', async (_label, requestedFor) => {
      await expect(
        customerService.create('c-1', body({ requestedFor }), customer),
      ).rejects.toMatchObject({
        status: 400,
        response: { details: { fields: [{ field: 'requestedFor', code: 'outOfRange' }] } },
      });
    });

    it('accepts any time on the last allowed Vietnam day and refuses the next midnight', async () => {
      mockedRequests.mockImplementation(async (_em, q) =>
        q.open ? [] : ([requestView()] as never),
      );
      const lastDay = addVietnamDays(vietnamToday(), 30);
      const evening = `${lastDay}T20:00:00+07:00`;
      await expect(
        customerService.create('c-1', body({ requestedFor: evening }), customer),
      ).resolves.toBeDefined();

      const nextMidnight = `${addVietnamDays(lastDay, 1)}T00:00:00+07:00`;
      await expect(
        customerService.create('c-1', body({ requestedFor: nextMidnight }), customer),
      ).rejects.toMatchObject({
        response: { details: { fields: [{ field: 'requestedFor', code: 'outOfRange' }] } },
      });
    });

    it('rejects a repeated item', async () => {
      const lines = [
        { itemId: 'i-1', quantity: 1 },
        { itemId: 'i-1', quantity: 1 },
      ];
      await expect(customerService.create('c-1', body({ lines }), customer)).rejects.toMatchObject({
        response: { details: { fields: [{ field: 'lines[1]', code: 'duplicateLine' }] } },
      });
    });

    it('maps the unique index violation to OPEN_REQUEST_EXISTS', async () => {
      mockedRequests.mockResolvedValue([]);
      em.insert.mockRejectedValue(
        new QueryFailedError('INSERT', [], Object.assign(new Error('dup'), { code: '23505' })),
      );
      await expect(customerService.create('c-1', body(), customer)).rejects.toMatchObject({
        response: { details: { reason: 'OPEN_REQUEST_EXISTS' } },
      });
    });
  });

  describe('cancel', () => {
    it.each(['PENDING', 'READY'])('cancels a %s request as the customer', async (status) => {
      lockedStatus = status;
      await customerService.cancel('req-1', customer);
      expect(em.update).toHaveBeenCalledWith(
        PickupRequest,
        { id: 'req-1' },
        expect.objectContaining({ status: 'CANCELLED', cancelledBy: 'cust-1' }),
      );
    });

    it('refuses a completed request', async () => {
      lockedStatus = 'COMPLETED';
      await expect(customerService.cancel('req-1', customer)).rejects.toMatchObject({
        response: { details: { reason: 'NOT_OPEN', status: 'COMPLETED' } },
      });
      expect(em.update).not.toHaveBeenCalled();
    });

    it('answers 404 for another customer’s request', async () => {
      await expect(
        customerService.cancel('req-1', { id: 'other' } as AuthUser),
      ).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('markReady', () => {
    it('marks a pending request ready and notifies the customer', async () => {
      await staffService.markReady('req-1', staff);
      expect(assertWorksAtFacility).toHaveBeenCalledWith(em, staff, 'fac-1');
      expect(em.update).toHaveBeenCalledWith(
        PickupRequest,
        { id: 'req-1' },
        expect.objectContaining({ status: 'READY', readyBy: 'staff-1' }),
      );
      expect(notifications.createForUsers).toHaveBeenCalledWith(
        em,
        ['cust-1'],
        expect.objectContaining({ type: 'PICKUP_REQUEST_READY' }),
      );
    });

    it('refuses a request that is not pending', async () => {
      lockedStatus = 'READY';
      await expect(staffService.markReady('req-1', staff)).rejects.toMatchObject({
        response: { details: { reason: 'NOT_PENDING' } },
      });
    });

    it('refuses staff of another facility', async () => {
      jest
        .mocked(assertWorksAtFacility)
        .mockRejectedValue(Object.assign(new Error('no'), { status: 403 }));
      await expect(staffService.markReady('req-1', staff)).rejects.toMatchObject({ status: 403 });
      expect(em.update).not.toHaveBeenCalled();
    });
  });

  describe('lists', () => {
    it('customer list is the latest 20 of an own contract', async () => {
      await customerService.listForContract('c-1', customer);
      expect(mockedContracts).toHaveBeenCalledWith(em, { contractId: 'c-1', customerId: 'cust-1' });
      expect(mockedRequests).toHaveBeenCalledWith(em, {
        contractIds: ['c-1'],
        order: 'newest',
        limit: 20,
      });
    });

    it('customer list answers 404 for a foreign contract', async () => {
      mockedContracts.mockResolvedValue([]);
      await expect(customerService.listForContract('c-1', customer)).rejects.toMatchObject({
        status: 404,
      });
    });

    it('warehouse list: OPEN by requested time, ALL latest 50', async () => {
      em.findOne.mockResolvedValue({ kind: StorageUnitKind.SHELF_WAREHOUSE, facilityId: 'fac-1' });
      await staffService.listForWarehouse('w-1', 'OPEN', staff);
      expect(mockedRequests).toHaveBeenLastCalledWith(em, {
        warehouseId: 'w-1',
        open: true,
        order: 'requestedFor',
      });
      await staffService.listForWarehouse('w-1', 'ALL', staff);
      expect(mockedRequests).toHaveBeenLastCalledWith(em, {
        warehouseId: 'w-1',
        order: 'newest',
        limit: 50,
      });
      expect(em.findOne).toHaveBeenCalledWith(StorageUnit, { where: { id: 'w-1' } });
    });

    it('warehouse list answers 404 for a non-shelf warehouse', async () => {
      em.findOne.mockResolvedValue({ kind: StorageUnitKind.SELF_STORAGE, facilityId: 'fac-1' });
      await expect(staffService.listForWarehouse('w-1', 'OPEN', staff)).rejects.toMatchObject({
        status: 404,
      });
    });
  });
});
