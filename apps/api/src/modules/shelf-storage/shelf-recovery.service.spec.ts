import type { AuthUser } from '@modules/auth/types/auth-user';
import { managesFacility } from '@modules/inspection/inspection-access.util';
import { UserRole } from '@storage/types';
import { findShelfContracts, loadStock } from './shelf-contract.query';
import { loadReceipts } from './shelf-receipt.read';
import { ShelfRecoveryService } from './shelf-recovery.service';

jest.mock('@modules/inspection/inspection-access.util');
jest.mock('./shelf-contract.query');
jest.mock('./shelf-receipt.read');

const manager = { id: 'fm-1', roles: [UserRole.FACILITY_MANAGER] } as AuthUser;
const itemId = '11111111-1111-4111-8111-111111111111';
const input = {
  clientRequestId: '22222222-2222-4222-8222-222222222222',
  contractId: 'c-1',
  lines: [{ itemId, quantity: 2 }],
  photos: [{ fileKey: 'uploads/fm-1-1-a.jpg', name: 'a.jpg', mimeType: 'image/jpeg' }],
  note: '  Khách bỏ kệ  ',
};
const recovered = {
  id: 'r-1',
  code: 'PL-1',
  type: 'PICK_UP',
  recovered: true,
  shelf: { code: 'K-1' },
  lines: [],
};

describe('ShelfRecoveryService', () => {
  let contract: Record<string, unknown>;
  let stock: unknown[];
  let replayRow: unknown[];
  let abandoned: unknown[];
  let warehouse: unknown;
  let abandonedRows: unknown[];
  let em: { query: jest.Mock; findOne: jest.Mock };
  let notifications: { createForUsers: jest.Mock };
  let service: ShelfRecoveryService;
  const calls = (prefix: string) =>
    em.query.mock.calls.filter(([sql]) => sql.trimStart().startsWith(prefix));

  beforeEach(() => {
    contract = {
      id: 'c-1',
      status: 'ACTIVE',
      customerId: 'cust-1',
      shelf: { id: 's-1' },
      warehouse: { id: 'w-1' },
      facility: { id: 'f-1' },
    };
    stock = [{ id: itemId, name: 'Sách', quantity: 5, updatedAt: new Date() }];
    replayRow = [];
    abandoned = [{ '?column?': 1 }];
    warehouse = { id: 'w-1', facilityId: 'f-1' };
    abandonedRows = [];
    em = {
      findOne: jest.fn(async () => warehouse),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('"client_request_id" = $1')) return replayRow;
        if (sql.includes('"request_source" = $2 LIMIT 1')) return abandoned;
        if (sql.includes('JOIN "inspections" i')) return abandonedRows;
        if (sql.includes('INTO "shelf_receipts"')) return [{ id: 'r-1' }];
        return [[], 1];
      }),
    };
    jest.mocked(managesFacility).mockResolvedValue(true);
    jest
      .mocked(findShelfContracts)
      .mockImplementation(async () => (contract ? [contract as never] : []));
    jest.mocked(loadStock).mockImplementation(async () => new Map([['c-1', stock as never]]));
    jest
      .mocked(loadReceipts)
      .mockImplementation(async () => ({ receipts: [recovered as never], total: 1 }));
    notifications = { createForUsers: jest.fn() };
    service = new ShelfRecoveryService(
      { manager: em, transaction: jest.fn((cb) => cb(em)) } as never,
      notifications as never,
    );
  });

  describe('list', () => {
    it('404s an unknown warehouse and 403s a manager of another facility', async () => {
      warehouse = null;
      await expect(service.list(manager, 'w-1')).rejects.toMatchObject({ status: 404 });
      warehouse = { id: 'w-1', facilityId: 'f-1' };
      jest.mocked(managesFacility).mockResolvedValue(false);
      await expect(service.list(manager, 'w-1')).rejects.toMatchObject({ status: 403 });
    });

    it('asks only for ACTIVE contracts with an open ABANDONED return and stock, oldest first', async () => {
      abandonedRows = [
        {
          contractId: 'c-1',
          contractNo: 'HD-1',
          shelfId: 's-1',
          shelfCode: 'K-1',
          shelfName: 'Kệ 1',
          customerId: 'cust-1',
          customerName: 'An',
          customerPhone: '0900',
          returnScheduledAt: new Date('2026-11-01T00:00:00Z'),
        },
      ];
      const result = await service.list(manager, 'w-1');

      const [sql, params] = calls('SELECT c."id"')[0] as [string, unknown[]];
      expect(sql).toContain('i."finalized_at" IS NULL AND i."request_source" = $2');
      expect(sql).toContain('s."quantity" > 0');
      expect(sql).toContain('ORDER BY i."scheduled_at"');
      expect(params).toEqual(['w-1', 'ABANDONED', 'ACTIVE']);
      expect(result).toEqual([
        expect.objectContaining({
          contractId: 'c-1',
          shelf: { id: 's-1', code: 'K-1', name: 'Kệ 1' },
          customer: { id: 'cust-1', fullName: 'An', phone: '0900' },
          items: stock,
        }),
      ]);
    });
  });

  describe('create', () => {
    it('records a scan-less pick-up and tells the customer', async () => {
      await expect(service.create(manager, input)).resolves.toBe(recovered);

      const [, params] = calls('INSERT INTO "shelf_receipts"')[0] as [string, unknown[]];
      expect(params[1]).toBe('PICK_UP');
      expect(params[7]).toBeNull(); // session_id
      expect(params[10]).toBe('Khách bỏ kệ');
      expect(calls('UPDATE "shelf_items"')[0][1]).toEqual([[itemId], [-2]]);
      expect(calls('UPDATE "pickup_requests"')).toHaveLength(0);
      expect(notifications.createForUsers).toHaveBeenCalledWith(
        em,
        ['cust-1'],
        expect.objectContaining({ type: 'SHELF_PICK_UP' }),
      );
    });

    it('closes open pick-up requests when the recovery empties the shelf', async () => {
      stock = [{ id: itemId, name: 'Sách', quantity: 2, updatedAt: new Date() }];
      await service.create(manager, input);
      const [sql, params] = calls('UPDATE "pickup_requests"')[0] as [string, unknown[]];
      expect(sql).toContain(`"status" = 'CANCELLED'`);
      expect(params).toEqual(['c-1']);
    });

    it('rejects a bad shape before any transaction', async () => {
      await expect(service.create(manager, { ...input, photos: [] })).rejects.toMatchObject({
        status: 400,
      });
    });

    it('403s a manager of another facility', async () => {
      jest.mocked(managesFacility).mockResolvedValue(false);
      await expect(service.create(manager, input)).rejects.toMatchObject({ status: 403 });
    });

    it('404s an unknown contract', async () => {
      contract = undefined as never;
      await expect(service.create(manager, input)).rejects.toMatchObject({ status: 404 });
    });

    it('replays a saved request without touching stock', async () => {
      replayRow = [{ id: 'r-1', contractId: 'c-1' }];
      await expect(service.create(manager, input)).resolves.toBe(recovered);
      expect(calls('UPDATE')).toHaveLength(0);
      expect(notifications.createForUsers).not.toHaveBeenCalled();
    });

    it('refuses a return that is open but not abandoned (customer or hotline source)', async () => {
      abandoned = [];
      await expect(service.create(manager, input)).rejects.toMatchObject({
        response: {
          code: 'SHELF_RECEIPT_NOT_ALLOWED',
          details: { reason: 'NOT_ABANDONED_RETURN' },
        },
      });
    });

    it('refuses a contract that is not ACTIVE', async () => {
      contract.status = 'ENDED';
      await expect(service.create(manager, input)).rejects.toMatchObject({
        response: { details: { reason: 'CONTRACT_NOT_ACTIVE' } },
      });
    });

    it('never looks at debt', async () => {
      await service.create(manager, input);
      expect(em.query.mock.calls.some(([sql]) => sql.includes('"invoices"'))).toBe(false);
    });

    it('reports a shortage as SHELF_STOCK_INSUFFICIENT', async () => {
      stock = [{ id: itemId, name: 'Sách', quantity: 1, updatedAt: new Date() }];
      await expect(service.create(manager, input)).rejects.toMatchObject({
        response: { code: 'SHELF_STOCK_INSUFFICIENT', details: { reason: 'PICK_UP' } },
      });
      expect(calls('INSERT INTO "shelf_receipts"')).toHaveLength(0);
    });
  });
});
