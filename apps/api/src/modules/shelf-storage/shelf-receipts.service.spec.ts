import { findOverdueInvoiceNos } from '@modules/access/overdue-invoices.query';
import { assertWorksAtFacility } from '@modules/access/staff-facility.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { DomainException } from '@shared/exceptions/domain.exception';
import { UserRole } from '@storage/types';
import { assertLiveSession } from './counter-session.util';
import { findShelfContracts, loadStock } from './shelf-contract.query';
import { loadReceipts } from './shelf-receipt.read';
import { ShelfReceiptsService } from './shelf-receipts.service';

jest.mock('@modules/access/overdue-invoices.query');
jest.mock('@modules/access/staff-facility.util');
jest.mock('./counter-session.util');
jest.mock('./shelf-contract.query');
jest.mock('./shelf-receipt.read');

const actor = { id: 'staff-1', roles: [UserRole.FACILITY_STAFF] } as AuthUser;
const uuid = (n: number) => `${String(n).repeat(8)}-0000-4000-8000-000000000000`;
const photo = { fileKey: 'uploads/staff-1-1-a.jpg', name: 'a.jpg', mimeType: 'image/jpeg' };
const base = {
  clientRequestId: uuid(1),
  sessionId: 'ses-1',
  contractId: 'c-1',
  type: 'DROP_OFF' as const,
  photos: [photo],
  lines: [{ name: 'Sách', quantity: 2 }],
};
const receipt = {
  id: 'r-1',
  code: 'PG-1',
  type: 'DROP_OFF',
  recovered: false,
  openDisputeTicket: null,
  contractId: 'c-1',
  customer: { id: 'cust-1' },
  lines: [],
  shelf: { code: 'K-1' },
};

describe('ShelfReceiptsService.create', () => {
  let contract: Record<string, unknown>;
  let stock: unknown[];
  let overdue: string[];
  let replayRow: unknown[];
  let requestRow: unknown[];
  let failInsertOnce: boolean;
  let em: { query: jest.Mock };
  let notifications: { createForUsers: jest.Mock };
  let transaction: jest.Mock;
  let service: ShelfReceiptsService;

  const sqlCalls = (prefix: string) =>
    em.query.mock.calls.filter(([sql]) => sql.trimStart().startsWith(prefix));
  const wrote = () => sqlCalls('INSERT').length + sqlCalls('UPDATE').length > 0;

  beforeEach(() => {
    jest.clearAllMocks();
    contract = {
      id: 'c-1',
      contractNo: 'HD-1',
      status: 'ACTIVE',
      customerId: 'cust-1',
      effectiveAt: new Date('2020-01-01T00:00:00Z'),
      returnOpen: false,
      shelf: { id: 's-1' },
      warehouse: { id: 'w-1' },
      facility: { id: 'f-1' },
    };
    stock = [{ id: 'i-1', name: 'Sách', quantity: 5, updatedAt: new Date() }];
    overdue = [];
    replayRow = [];
    requestRow = [{ contractId: 'c-1', status: 'READY' }];
    failInsertOnce = false;
    em = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('"client_request_id" = $1')) return replayRow;
        if (sql.includes('FROM "pickup_requests"')) return requestRow;
        if (sql.includes('INTO "shelf_receipts"')) {
          if (failInsertOnce) {
            failInsertOnce = false;
            throw Object.assign(new Error('dup'), { code: '23505' });
          }
          return [{ id: 'r-1' }];
        }
        if (sql.includes('INTO "shelf_items"')) return [{ id: 'new-1' }];
        return [[], 1];
      }),
    };
    jest.mocked(findShelfContracts).mockImplementation(async () => [contract as never]);
    jest.mocked(loadStock).mockImplementation(async () => new Map([['c-1', stock as never]]));
    jest.mocked(findOverdueInvoiceNos).mockImplementation(async () => overdue);
    jest.mocked(assertWorksAtFacility).mockResolvedValue(undefined);
    jest.mocked(assertLiveSession).mockResolvedValue({ id: 'ses-1' } as never);
    jest
      .mocked(loadReceipts)
      .mockImplementation(async () => ({ receipts: [receipt as never], total: 1 }));
    notifications = { createForUsers: jest.fn() };
    transaction = jest.fn((cb) => cb(em));
    service = new ShelfReceiptsService({ transaction } as never, notifications as never);
  });

  it('records a drop-off: locks the contract, adds stock, notifies the customer', async () => {
    await expect(service.create(actor, base)).resolves.toBe(receipt);

    expect(findShelfContracts).toHaveBeenCalledWith(em, { contractId: 'c-1', lock: true });
    expect(loadStock).toHaveBeenCalledWith(em, ['c-1'], { lock: true, includeEmpty: true });
    expect(sqlCalls('UPDATE "shelf_items"')[0][1]).toEqual([['i-1'], [2]]);
    const [, params] = sqlCalls('INSERT INTO "shelf_receipts"')[0] as [string, unknown[]];
    expect(params.slice(1, 4)).toEqual(['DROP_OFF', 'c-1', 'cust-1']);
    expect(params[7]).toBe('ses-1');
    expect(notifications.createForUsers).toHaveBeenCalledWith(
      em,
      ['cust-1'],
      expect.objectContaining({
        type: 'SHELF_DROP_OFF',
      }),
    );
  });

  it('404s an unknown contract and 403s another facility before anything else', async () => {
    jest.mocked(findShelfContracts).mockResolvedValueOnce([]);
    await expect(service.create(actor, base)).rejects.toMatchObject({ status: 404 });

    jest
      .mocked(assertWorksAtFacility)
      .mockRejectedValueOnce(new DomainException('FORBIDDEN' as never, 'no', 403));
    await expect(service.create(actor, base)).rejects.toMatchObject({ status: 403 });
    expect(assertLiveSession).not.toHaveBeenCalled();
  });

  it('answers a replayed request with the saved receipt and no stock change', async () => {
    replayRow = [{ id: 'r-1', contractId: 'c-1' }];
    await expect(service.create(actor, base)).resolves.toBe(receipt);
    expect(wrote()).toBe(false);
    expect(notifications.createForUsers).not.toHaveBeenCalled();
  });

  it('refuses a request id reused on another contract', async () => {
    replayRow = [{ id: 'r-9', contractId: 'c-9' }];
    await expect(service.create(actor, base)).rejects.toMatchObject({
      response: { code: 'SHELF_RECEIPT_NOT_ALLOWED', details: { reason: 'CLIENT_REQUEST_REUSED' } },
    });
  });

  it('refuses a contract that is not ACTIVE', async () => {
    contract.status = 'ENDED';
    await expect(service.create(actor, base)).rejects.toMatchObject({
      response: { details: { reason: 'CONTRACT_NOT_ACTIVE' } },
    });
  });

  it('refuses a drop-off before the contract starts', async () => {
    const effectiveAt = new Date(Date.now() + 5 * 86_400_000);
    contract.effectiveAt = effectiveAt;
    await expect(service.create(actor, base)).rejects.toMatchObject({
      response: {
        code: 'SHELF_RECEIPT_NOT_ALLOWED',
        details: { reason: 'CONTRACT_NOT_STARTED', effectiveAt },
      },
    });
  });

  it('refuses a drop-off with an overdue invoice, even while a return is open', async () => {
    overdue = ['INV-1'];
    contract.returnOpen = true;
    await expect(service.create(actor, base)).rejects.toMatchObject({
      response: { code: 'INVOICE_OVERDUE', details: { invoiceNos: ['INV-1'] } },
    });
    expect(wrote()).toBe(false);
  });

  const pickUp = {
    ...base,
    type: 'PICK_UP' as const,
    photos: [],
    lines: [{ itemId: uuid(2), quantity: 1 }],
  };

  it('refuses a pick-up with an overdue invoice and no open return', async () => {
    overdue = ['INV-1'];
    await expect(service.create(actor, pickUp)).rejects.toMatchObject({
      response: { code: 'INVOICE_OVERDUE' },
    });
  });

  it('lets an overdue customer pick up while a return is open', async () => {
    overdue = ['INV-1'];
    contract.returnOpen = true;
    stock = [{ id: uuid(2), name: 'Sách', quantity: 5, updatedAt: new Date() }];
    await service.create(actor, pickUp);
    expect(sqlCalls('UPDATE "shelf_items"')[0][1]).toEqual([[uuid(2)], [-1]]);
    expect(notifications.createForUsers).toHaveBeenCalled();
  });

  it('reports a pick-up shortage without writing', async () => {
    stock = [{ id: uuid(2), name: 'Sách', quantity: 0, updatedAt: new Date() }];
    await expect(service.create(actor, pickUp)).rejects.toMatchObject({
      response: { code: 'SHELF_STOCK_INSUFFICIENT', details: { reason: 'PICK_UP' } },
    });
    expect(wrote()).toBe(false);
  });

  it('completes the contract open request it was given', async () => {
    stock = [{ id: uuid(2), name: 'Sách', quantity: 5, updatedAt: new Date() }];
    await service.create(actor, { ...pickUp, pickupRequestId: uuid(3) });
    const [sql, params] = sqlCalls('UPDATE "pickup_requests"')[0] as [string, unknown[]];
    expect(sql).toContain(`"status" = 'COMPLETED'`);
    expect(params).toEqual([uuid(3)]);
  });

  it.each([
    ['another contract', [{ contractId: 'c-9', status: 'READY' }]],
    ['an unknown request', []],
    ['a closed request', [{ contractId: 'c-1', status: 'COMPLETED' }]],
  ])('refuses %s as a mismatch', async (_label, row) => {
    requestRow = row;
    await expect(
      service.create(actor, { ...pickUp, pickupRequestId: uuid(3) }),
    ).rejects.toMatchObject({
      response: { details: { reason: 'PICKUP_REQUEST_MISMATCH' } },
    });
  });

  it('leaves an open request alone when none is given', async () => {
    stock = [{ id: uuid(2), name: 'Sách', quantity: 5, updatedAt: new Date() }];
    await service.create(actor, pickUp);
    expect(sqlCalls('UPDATE "pickup_requests"')).toHaveLength(0);
  });

  it('system-cancels requests still open when a pick-up takes the last goods', async () => {
    stock = [{ id: uuid(2), name: 'Sách', quantity: 1, updatedAt: new Date() }];
    await service.create(actor, pickUp);
    const [sql, params] = sqlCalls('UPDATE "pickup_requests"')[0] as [string, unknown[]];
    expect(sql).toContain(`"status" = 'CANCELLED'`);
    expect(params).toEqual(['c-1']);
  });

  it('completes the given request first; the cancel then only sweeps other open ones', async () => {
    stock = [{ id: uuid(2), name: 'Sách', quantity: 1, updatedAt: new Date() }];
    await service.create(actor, { ...pickUp, pickupRequestId: uuid(3) });
    const statements = sqlCalls('UPDATE "pickup_requests"').map(([sql]) => sql as string);
    expect(statements[0]).toContain(`'COMPLETED'`);
    expect(statements[1]).toContain(`'CANCELLED'`);
  });

  it('never cancels requests on a drop-off', async () => {
    await service.create(actor, base);
    expect(sqlCalls('UPDATE "pickup_requests"')).toHaveLength(0);
  });

  it('retries in a fresh transaction when the receipt code collides', async () => {
    failInsertOnce = true;
    await expect(service.create(actor, base)).resolves.toBe(receipt);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('rejects a malformed drop-off before opening a transaction', async () => {
    await expect(service.create(actor, { ...base, photos: [] })).rejects.toMatchObject({
      status: 400,
    });
    expect(transaction).not.toHaveBeenCalled();
  });
});
