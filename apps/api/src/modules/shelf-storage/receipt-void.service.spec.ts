import type { AuthUser } from '@modules/auth/types/auth-user';
import { managesFacility } from '@modules/inspection/inspection-access.util';
import { UserRole } from '@storage/types';
import { ReceiptVoidService } from './receipt-void.service';
import { findShelfContracts, loadStock } from './shelf-contract.query';
import { loadReceipts } from './shelf-receipt.read';

jest.mock('@modules/inspection/inspection-access.util');
jest.mock('./shelf-contract.query');
jest.mock('./shelf-receipt.read');

const actor = { id: 'fm-1', roles: [UserRole.FACILITY_MANAGER] } as AuthUser;
const voided = { id: 'r-1', code: 'PG-1', shelf: { code: 'K-1' }, lines: [] };

describe('ReceiptVoidService.void', () => {
  let head: unknown[];
  let current: { status: string };
  let lines: unknown[];
  let stock: unknown[];
  let contract: Record<string, unknown>;
  let em: { query: jest.Mock };
  let notifications: { createForUsers: jest.Mock };
  let service: ReceiptVoidService;
  const call = (prefix: string) =>
    em.query.mock.calls.find(([sql]) => sql.trimStart().startsWith(prefix)) as
      | [string, unknown[]]
      | undefined;

  beforeEach(() => {
    head = [{ contractId: 'c-1', facilityId: 'f-1', type: 'DROP_OFF', status: 'ACTIVE' }];
    current = { status: 'ACTIVE' };
    lines = [{ itemId: 'i-1', name: 'Sách', quantity: 2 }];
    stock = [{ id: 'i-1', name: 'Sách', quantity: 5, updatedAt: new Date() }];
    contract = { id: 'c-1', status: 'ACTIVE', customerId: 'cust-1' };
    em = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FOR UPDATE')) return [current];
        if (sql.includes('FROM "shelf_receipt_lines"')) return lines;
        if (sql.includes('FROM "shelf_receipts"')) return head;
        return [[], 1];
      }),
    };
    jest.mocked(managesFacility).mockResolvedValue(true);
    jest.mocked(findShelfContracts).mockImplementation(async () => [contract as never]);
    jest.mocked(loadStock).mockImplementation(async () => new Map([['c-1', stock as never]]));
    jest
      .mocked(loadReceipts)
      .mockImplementation(async () => ({ receipts: [voided as never], total: 1 }));
    notifications = { createForUsers: jest.fn() };
    service = new ReceiptVoidService(
      { transaction: jest.fn((cb) => cb(em)) } as never,
      notifications as never,
    );
  });

  it('404s an unknown receipt', async () => {
    head = [];
    await expect(service.void(actor, 'r-1', 'Nhầm')).rejects.toMatchObject({ status: 404 });
  });

  it('403s a manager of another facility before locking anything', async () => {
    jest.mocked(managesFacility).mockResolvedValue(false);
    await expect(service.void(actor, 'r-1', 'Nhầm')).rejects.toMatchObject({ status: 403 });
    expect(managesFacility).toHaveBeenCalledWith(em, actor, 'f-1');
    expect(findShelfContracts).not.toHaveBeenCalled();
  });

  it('refuses a receipt already voided', async () => {
    current = { status: 'VOIDED' };
    await expect(service.void(actor, 'r-1', 'Nhầm')).rejects.toMatchObject({
      status: 409,
      response: { code: 'CONFLICT', details: { reason: 'ALREADY_VOIDED' } },
    });
  });

  it('refuses when the contract has ended', async () => {
    contract.status = 'ENDED';
    await expect(service.void(actor, 'r-1', 'Nhầm')).rejects.toMatchObject({
      response: { code: 'SHELF_RECEIPT_NOT_ALLOWED', details: { reason: 'CONTRACT_NOT_ACTIVE' } },
    });
  });

  it('refuses a drop-off void when its goods were taken since', async () => {
    stock = [{ id: 'i-1', name: 'Sách', quantity: 1, updatedAt: new Date() }];
    await expect(service.void(actor, 'r-1', 'Nhầm')).rejects.toMatchObject({
      response: { code: 'SHELF_STOCK_INSUFFICIENT', details: { reason: 'VOID' } },
    });
    expect(call('UPDATE "shelf_receipts"')).toBeUndefined();
  });

  it('reverses stock, marks the receipt and notifies the customer', async () => {
    await expect(service.void(actor, 'r-1', '  Nhập nhầm  ')).resolves.toBe(voided);

    expect(findShelfContracts).toHaveBeenCalledWith(em, { contractId: 'c-1', lock: true });
    expect(call('UPDATE "shelf_items"')?.[1]).toEqual([['i-1'], [-2]]);
    expect(call('UPDATE "shelf_receipts"')?.[1]).toEqual(['r-1', 'fm-1', 'Nhập nhầm']);
    expect(notifications.createForUsers).toHaveBeenCalledWith(
      em,
      ['cust-1'],
      expect.objectContaining({ type: 'SHELF_RECEIPT_VOIDED' }),
    );
  });

  it('puts a voided pick-up back on the shelf', async () => {
    head = [{ contractId: 'c-1', facilityId: 'f-1', type: 'PICK_UP', status: 'ACTIVE' }];
    await service.void(actor, 'r-1', 'Nhầm');
    expect(call('UPDATE "shelf_items"')?.[1]).toEqual([['i-1'], [2]]);
  });
});
