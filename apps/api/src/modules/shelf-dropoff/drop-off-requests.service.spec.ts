import { DropOffRequest } from '@entities/drop-off-request.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { findOverdueInvoiceNos } from '@modules/access/overdue-invoices.query';
import { assertWorksAtFacility } from '@modules/access/staff-facility.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { addVietnamDays, vietnamToday } from '@shared/utils/calendar.util';
import { ContractStatus, StorageUnitKind } from '@storage/types';
import { QueryFailedError } from 'typeorm';
import { loadDropOffRequests } from '../shelf-storage/drop-off-request.read';
import { findShelfContracts, loadStock } from '../shelf-storage/shelf-contract.query';
import { DropOffRequestsService } from './drop-off-requests.service';
import { DropOffRequestsStaffService } from './drop-off-requests-staff.service';

jest.mock('@modules/access/overdue-invoices.query');
jest.mock('@modules/access/staff-facility.util');
jest.mock('../shelf-storage/drop-off-request.read');
jest.mock('../shelf-storage/shelf-contract.query');

const customer = { id: 'cust-1' } as AuthUser;
const staff = { id: 'staff-1' } as AuthUser;
const DAY = 24 * 3600 * 1000;
const FUTURE = () => new Date(Date.now() + 2 * DAY).toISOString();

const contractRow = (overrides = {}) => ({
  id: 'c-1',
  status: ContractStatus.ACTIVE,
  customerId: 'cust-1',
  effectiveAt: new Date('2020-01-01T00:00:00Z'),
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

describe('drop-off requests', () => {
  let em: { insert: jest.Mock; update: jest.Mock; query: jest.Mock; findOne: jest.Mock };
  let notifications: { createForUsers: jest.Mock };
  let customerService: DropOffRequestsService;
  let staffService: DropOffRequestsStaffService;
  let lockedStatus: string;
  let lockedRows: () => unknown[];

  const mockedContracts = jest.mocked(findShelfContracts);
  const mockedRequests = jest.mocked(loadDropOffRequests);

  beforeEach(() => {
    lockedStatus = 'PENDING';
    lockedRows = () => [{ status: lockedStatus }];
    em = {
      insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 'req-1' }] }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      query: jest.fn(async (sql: string) =>
        sql.includes('FOR UPDATE') && sql.includes('drop_off_requests')
          ? lockedRows()
          : [{ userId: 'staff-9' }],
      ),
      findOne: jest.fn(),
    };
    notifications = { createForUsers: jest.fn() };
    const dataSource = {
      manager: em,
      transaction: jest.fn((cb: (e: unknown) => unknown) => cb(em)),
    };
    customerService = new DropOffRequestsService(dataSource as never, notifications as never);
    staffService = new DropOffRequestsStaffService(dataSource as never, notifications as never);
    mockedContracts.mockResolvedValue([contractRow()] as never);
    jest
      .mocked(loadStock)
      .mockResolvedValue(
        new Map([['c-1', [item('i-1', 'Sách', 5), item('i-2', 'Chăn bông', 0)] as never]]),
      );
    // The open-request lookup is the call with `open: true`; by default there is none.
    mockedRequests.mockImplementation(async (_em, q) => (q.open ? [] : ([requestView()] as never)));
    jest.mocked(findOverdueInvoiceNos).mockResolvedValue([]);
    jest.mocked(assertWorksAtFacility).mockResolvedValue(undefined);
  });

  afterEach(() => jest.resetAllMocks());

  describe('create', () => {
    const body = (patch = {}) => ({
      lines: [{ itemId: 'i-1', quantity: 2 }] as {
        itemId?: string;
        name?: string;
        quantity: number;
      }[],
      requestedFor: FUTURE(),
      ...patch,
    });
    const openRequestExists = () =>
      mockedRequests.mockImplementation(async (_em, q) =>
        q.open ? ([requestView({ id: 'open-1' })] as never) : ([requestView()] as never),
      );

    it('stores lines by item or by name and notifies the facility staff on the same transaction', async () => {
      const lines = [
        { itemId: 'i-1', quantity: 2 },
        { name: '  Thùng   sách ', quantity: 1 },
      ];

      const result = await customerService.create('c-1', body({ lines, note: ' hi ' }), customer);

      expect(mockedContracts).toHaveBeenCalledWith(em, { contractId: 'c-1', lock: true });
      expect(loadStock).toHaveBeenCalledWith(em, ['c-1'], { includeEmpty: true });
      expect(em.insert).toHaveBeenCalledWith(
        DropOffRequest,
        expect.objectContaining({
          contractId: 'c-1',
          customerId: 'cust-1',
          note: 'hi',
          lines: [
            { itemId: 'i-1', name: 'Sách', quantity: 2 },
            { itemId: null, name: 'Thùng sách', quantity: 1 },
          ],
        }),
      );
      expect(mockedRequests).toHaveBeenLastCalledWith(em, { ids: ['req-1'], order: 'newest' });
      expect(em.query).toHaveBeenCalledWith(expect.stringContaining('user_role_assignments'), [
        'fac-1',
      ]);
      expect(notifications.createForUsers).toHaveBeenCalledWith(
        em,
        ['staff-9'],
        expect.objectContaining({ type: 'DROP_OFF_REQUEST_CREATED' }),
      );
      expect(result.id).toBe('req-1');
    });

    it('turns a name matching an existing item (even an empty one) into that item', async () => {
      const lines = [
        { name: 'SÁCH', quantity: 1 },
        { name: ' chăn   BÔNG', quantity: 3 },
      ];
      await customerService.create('c-1', body({ lines }), customer);
      expect(em.insert).toHaveBeenCalledWith(
        DropOffRequest,
        expect.objectContaining({
          note: null,
          lines: [
            { itemId: 'i-1', name: 'Sách', quantity: 1 },
            { itemId: 'i-2', name: 'Chăn bông', quantity: 3 },
          ],
        }),
      );
    });

    it('stores a blank note as null', async () => {
      await customerService.create('c-1', body({ note: '   ' }), customer);
      expect(em.insert).toHaveBeenCalledWith(
        DropOffRequest,
        expect.objectContaining({ note: null }),
      );
    });

    it('rejects an item id and a name that resolve to the same item', async () => {
      const lines = [
        { itemId: 'i-1', quantity: 1 },
        { name: 'sách', quantity: 1 },
      ];
      await expect(customerService.create('c-1', body({ lines }), customer)).rejects.toMatchObject({
        status: 400,
        response: { details: { fields: [{ field: 'lines', code: 'duplicateLine' }] } },
      });
      expect(em.insert).not.toHaveBeenCalled();
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
      expect(em.insert).not.toHaveBeenCalled();
    });

    it('refuses an ended contract', async () => {
      mockedContracts.mockResolvedValue([contractRow({ status: ContractStatus.ENDED })] as never);
      await expect(customerService.create('c-1', body(), customer)).rejects.toMatchObject({
        status: 409,
        response: {
          code: 'DROP_OFF_REQUEST_NOT_ALLOWED',
          details: { reason: 'CONTRACT_NOT_ACTIVE' },
        },
      });
    });

    it('refuses a second open request and names it', async () => {
      openRequestExists();
      await expect(customerService.create('c-1', body(), customer)).rejects.toMatchObject({
        response: {
          code: 'DROP_OFF_REQUEST_NOT_ALLOWED',
          details: { reason: 'OPEN_REQUEST_EXISTS', requestId: 'open-1' },
        },
      });
      expect(em.insert).not.toHaveBeenCalled();
    });

    it('maps the unique index violation to OPEN_REQUEST_EXISTS', async () => {
      em.insert.mockRejectedValue(
        new QueryFailedError('INSERT', [], Object.assign(new Error('dup'), { code: '23505' })),
      );
      await expect(customerService.create('c-1', body(), customer)).rejects.toMatchObject({
        response: {
          code: 'DROP_OFF_REQUEST_NOT_ALLOWED',
          details: { reason: 'OPEN_REQUEST_EXISTS' },
        },
      });
    });

    it('passes other database errors through', async () => {
      const failure = new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('fk'), { code: '23503' }),
      );
      em.insert.mockRejectedValue(failure);
      await expect(customerService.create('c-1', body(), customer)).rejects.toBe(failure);
    });

    it('refuses while an invoice is overdue, even while a return is open', async () => {
      jest.mocked(findOverdueInvoiceNos).mockResolvedValue(['INV-1']);
      mockedContracts.mockResolvedValue([contractRow({ returnOpen: true })] as never);
      await expect(customerService.create('c-1', body(), customer)).rejects.toMatchObject({
        status: 409,
        response: { code: 'INVOICE_OVERDUE', details: { invoiceNos: ['INV-1'] } },
      });
      expect(findOverdueInvoiceNos).toHaveBeenCalledWith(em, 'cust-1', expect.any(Date));
      expect(em.insert).not.toHaveBeenCalled();
    });

    it('refuses a time before the contract start day', async () => {
      const effectiveAt = new Date(Date.now() + 5 * DAY);
      mockedContracts.mockResolvedValue([contractRow({ effectiveAt })] as never);
      await expect(customerService.create('c-1', body(), customer)).rejects.toMatchObject({
        response: { details: { reason: 'BEFORE_CONTRACT_START', effectiveAt } },
      });
    });

    it('accepts 00:00 Vietnam time on the start day', async () => {
      const startDay = addVietnamDays(vietnamToday(), 3);
      mockedContracts.mockResolvedValue([
        contractRow({ effectiveAt: new Date(`${startDay}T15:00:00+07:00`) }),
      ] as never);
      await expect(
        customerService.create(
          'c-1',
          body({ requestedFor: `${startDay}T00:00:00+07:00` }),
          customer,
        ),
      ).resolves.toBeDefined();
    });

    it('rejects an item that is not on the shelf', async () => {
      await expect(
        customerService.create('c-1', body({ lines: [{ itemId: 'zzz', quantity: 1 }] }), customer),
      ).rejects.toMatchObject({
        response: { details: { reason: 'ITEM_NOT_IN_CONTRACT', itemIds: ['zzz'] } },
      });
      expect(em.insert).not.toHaveBeenCalled();
    });

    it.each([
      ['in the past', new Date(Date.now() - 3600_000).toISOString()],
      ['over 30 days ahead', new Date(Date.now() + 31 * DAY).toISOString()],
    ])('rejects a time %s before opening a transaction', async (_label, requestedFor) => {
      await expect(
        customerService.create('c-1', body({ requestedFor }), customer),
      ).rejects.toMatchObject({
        status: 400,
        response: { details: { fields: [{ field: 'requestedFor', code: 'outOfRange' }] } },
      });
      expect(mockedContracts).not.toHaveBeenCalled();
    });

    it('accepts any time on the last allowed Vietnam day and refuses the next midnight', async () => {
      const lastDay = addVietnamDays(vietnamToday(), 30);
      await expect(
        customerService.create(
          'c-1',
          body({ requestedFor: `${lastDay}T20:00:00+07:00` }),
          customer,
        ),
      ).resolves.toBeDefined();

      const nextMidnight = `${addVietnamDays(lastDay, 1)}T00:00:00+07:00`;
      await expect(
        customerService.create('c-1', body({ requestedFor: nextMidnight }), customer),
      ).rejects.toMatchObject({
        response: { details: { fields: [{ field: 'requestedFor', code: 'outOfRange' }] } },
      });
    });

    it.each([
      ['both id and name', [{ itemId: 'i-1', name: 'Sách', quantity: 1 }], 'lineShape'],
      ['neither id nor name', [{ quantity: 1 }], 'lineShape'],
      ['zero quantity', [{ name: 'Sách', quantity: 0 }], 'lineShape'],
      ['blank name', [{ name: '   ', quantity: 1 }], 'lineShape'],
    ])('rejects a line with %s', async (_label, lines, code) => {
      await expect(customerService.create('c-1', body({ lines }), customer)).rejects.toMatchObject({
        status: 400,
        response: { details: { fields: [{ field: 'lines[0]', code }] } },
      });
      expect(mockedContracts).not.toHaveBeenCalled();
    });

    it('rejects a repeated line', async () => {
      const lines = [
        { name: 'Sách', quantity: 1 },
        { name: ' sách ', quantity: 1 },
      ];
      await expect(customerService.create('c-1', body({ lines }), customer)).rejects.toMatchObject({
        response: { details: { fields: [{ field: 'lines[1]', code: 'duplicateLine' }] } },
      });
    });
  });

  describe('cancel', () => {
    it.each(['PENDING', 'CONFIRMED'])(
      'cancels a %s request as the customer and tells the staff',
      async (status) => {
        lockedStatus = status;
        await customerService.cancel('req-1', customer);
        expect(mockedContracts).toHaveBeenCalledWith(em, { contractId: 'c-1', lock: true });
        expect(em.update).toHaveBeenCalledWith(
          DropOffRequest,
          { id: 'req-1' },
          expect.objectContaining({ status: 'CANCELLED', cancelledBy: 'cust-1' }),
        );
        expect(notifications.createForUsers).toHaveBeenCalledWith(
          em,
          ['staff-9'],
          expect.objectContaining({ type: 'DROP_OFF_REQUEST_CANCELLED' }),
        );
      },
    );

    it.each(['COMPLETED', 'CANCELLED'])('refuses a %s request', async (status) => {
      lockedStatus = status;
      await expect(customerService.cancel('req-1', customer)).rejects.toMatchObject({
        status: 409,
        response: { details: { reason: 'NOT_OPEN', status } },
      });
      expect(em.update).not.toHaveBeenCalled();
      expect(notifications.createForUsers).not.toHaveBeenCalled();
    });

    it('answers 404 for another customer’s or a missing request', async () => {
      await expect(
        customerService.cancel('req-1', { id: 'other' } as AuthUser),
      ).rejects.toMatchObject({ status: 404 });
      mockedRequests.mockResolvedValue([]);
      await expect(customerService.cancel('req-1', customer)).rejects.toMatchObject({
        status: 404,
      });
      expect(em.update).not.toHaveBeenCalled();
    });

    it('answers 404 when the locked row has vanished', async () => {
      lockedRows = () => [];
      await expect(customerService.cancel('req-1', customer)).rejects.toMatchObject({
        status: 404,
      });
    });

    it('cancels without a notice when the contract is gone', async () => {
      mockedContracts.mockResolvedValue([]);
      await customerService.cancel('req-1', customer);
      expect(em.update).toHaveBeenCalled();
      expect(notifications.createForUsers).not.toHaveBeenCalled();
    });
  });

  describe('confirm', () => {
    it('confirms a pending request and notifies the customer', async () => {
      await staffService.confirm('req-1', staff);
      expect(assertWorksAtFacility).toHaveBeenCalledWith(em, staff, 'fac-1');
      expect(em.update).toHaveBeenCalledWith(
        DropOffRequest,
        { id: 'req-1' },
        expect.objectContaining({ status: 'CONFIRMED', confirmedBy: 'staff-1' }),
      );
      expect(notifications.createForUsers).toHaveBeenCalledWith(
        em,
        ['cust-1'],
        expect.objectContaining({ type: 'DROP_OFF_REQUEST_CONFIRMED' }),
      );
    });

    it.each(['CONFIRMED', 'COMPLETED', 'CANCELLED'])('refuses a %s request', async (status) => {
      lockedStatus = status;
      await expect(staffService.confirm('req-1', staff)).rejects.toMatchObject({
        status: 409,
        response: { details: { reason: 'NOT_PENDING', status } },
      });
      expect(em.update).not.toHaveBeenCalled();
    });

    it('refuses a request whose contract is no longer active', async () => {
      mockedContracts.mockResolvedValue([contractRow({ status: ContractStatus.ENDED })] as never);
      await expect(staffService.confirm('req-1', staff)).rejects.toMatchObject({
        response: {
          code: 'DROP_OFF_REQUEST_NOT_ALLOWED',
          details: { reason: 'CONTRACT_NOT_ACTIVE' },
        },
      });
      expect(em.update).not.toHaveBeenCalled();
    });

    it('answers 404 for a missing request or contract', async () => {
      mockedRequests.mockResolvedValue([]);
      await expect(staffService.confirm('req-1', staff)).rejects.toMatchObject({ status: 404 });

      mockedRequests.mockResolvedValue([requestView()] as never);
      mockedContracts.mockResolvedValue([]);
      await expect(staffService.confirm('req-1', staff)).rejects.toMatchObject({ status: 404 });
      expect(em.update).not.toHaveBeenCalled();
    });

    it('refuses staff of another facility', async () => {
      jest
        .mocked(assertWorksAtFacility)
        .mockRejectedValue(Object.assign(new Error('no'), { status: 403 }));
      await expect(staffService.confirm('req-1', staff)).rejects.toMatchObject({ status: 403 });
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
      expect(assertWorksAtFacility).toHaveBeenCalledWith(em, staff, 'fac-1');
    });

    it('warehouse list answers 404 for a missing or non-shelf warehouse', async () => {
      em.findOne.mockResolvedValue({ kind: StorageUnitKind.SELF_STORAGE, facilityId: 'fac-1' });
      await expect(staffService.listForWarehouse('w-1', 'OPEN', staff)).rejects.toMatchObject({
        status: 404,
      });
      em.findOne.mockResolvedValue(null);
      await expect(staffService.listForWarehouse('w-1', 'ALL', staff)).rejects.toMatchObject({
        status: 404,
      });
      expect(mockedRequests).not.toHaveBeenCalled();
    });
  });
});
