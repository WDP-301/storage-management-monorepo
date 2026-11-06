import type { AuthUser } from '@modules/auth/types/auth-user';
import { AccessPassService } from './access-pass.service';
import { parsePayload } from './check-in-eligibility';

const user = { id: 'cust-1' } as AuthUser;

const contractRow = (over: Record<string, unknown> = {}) => ({
  id: 'c-1',
  contractNo: 'HD-1',
  status: 'ACTIVE',
  customerId: 'cust-1',
  effectiveAt: new Date('2020-01-01T00:00:00Z'),
  shelfId: 's-1',
  shelfCode: 'K-1',
  shelfName: 'Kệ 1',
  warehouseId: 'w-1',
  warehouseCode: 'W-1',
  warehouseName: 'Kho 1',
  facilityId: 'f-1',
  facilityCode: 'F-1',
  facilityName: 'CN 1',
  returnOpen: false,
  ...over,
});

describe('AccessPassService.createPass', () => {
  let contracts: Record<string, unknown>[];
  let overdue: { invoiceNo: string }[];
  let em: { query: jest.Mock };
  let order: string[];
  let service: AccessPassService;

  beforeEach(() => {
    order = [];
    contracts = [contractRow()];
    overdue = [];
    em = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FOR NO KEY UPDATE')) {
          order.push('lock');
          return [{}];
        }
        if (sql.includes('FROM "contracts"')) return contracts;
        if (sql.includes('FROM "invoices"')) return overdue;
        if (sql.startsWith('DELETE')) {
          order.push('prune');
          return [[], 0];
        }
        if (sql.startsWith('UPDATE')) {
          order.push('expire');
          return [[], 0];
        }
        order.push('insert');
        return [{ id: 'pass-1', expires_at: new Date(Date.now() + 600_000) }];
      }),
    };
    const dataSource = { transaction: jest.fn((cb) => cb(em)) };
    const settings = { getCheckInQrTtlMinutes: jest.fn().mockResolvedValue(10) };
    service = new AccessPassService(dataSource as never, settings as never);
  });

  const call = (prefix: string) =>
    em.query.mock.calls.find(([sql]) => sql.startsWith(prefix)) as [string, unknown[]];

  it('issues a pass: raw token only in the payload, sha256 stored, ttl from setting', async () => {
    const result = await service.createPass(user);

    const [, params] = call('INSERT');
    const token = parsePayload(result.qrPayload) as string;
    expect(token).toHaveLength(43);
    expect(params[0]).toBe('cust-1');
    expect(params[2]).toMatch(/^[0-9a-f]{64}$/);
    expect(params).not.toContain(token);
    expect(params[3]).toBe(10);
    expect(result.ttlSeconds).toBeGreaterThan(595);
    expect(result.id).toBe('pass-1');
  });

  it('stores the pass as a counter scan', async () => {
    await service.createPass(user);

    expect(call('INSERT')[1][1]).toBe('COUNTER_SCAN');
  });

  it('locks the customer, prunes stale passes, expires older ones, then inserts', async () => {
    await service.createPass(user);

    expect(order).toEqual(['lock', 'prune', 'expire', 'insert']);
  });

  it('prunes and expires only unused passes of this customer', async () => {
    await service.createPass(user);

    const [prune, pruneParams] = call('DELETE');
    expect(prune).toContain('"customer_id" = $1 AND "used_at" IS NULL');
    expect(prune).toContain(`"expires_at" < now() - interval '1 day'`);
    expect(pruneParams).toEqual(['cust-1']);
    expect(call('UPDATE')[1]).toEqual(['cust-1']);
  });

  it('refuses with the overdue invoice numbers and issues nothing', async () => {
    overdue = [{ invoiceNo: 'INV-9' }];

    await expect(service.createPass(user)).rejects.toMatchObject({
      status: 409,
      response: { code: 'INVOICE_OVERDUE', details: { invoiceNos: ['INV-9'] } },
    });
    expect(order).toEqual(['lock']);
  });

  it('issues to an overdue customer whose contract is being returned', async () => {
    overdue = [{ invoiceNo: 'INV-9' }];
    contracts = [contractRow({ returnOpen: true })];

    await expect(service.createPass(user)).resolves.toMatchObject({ id: 'pass-1' });
  });

  it('refuses a customer without an ACTIVE shelf contract', async () => {
    contracts = [];

    await expect(service.createPass(user)).rejects.toMatchObject({
      response: { code: 'CHECK_IN_NOT_ALLOWED', details: { reason: 'NO_SHELF_CONTRACT' } },
    });
  });

  it('refuses until the earliest contract starts, and reports that date', async () => {
    const soon = new Date(Date.now() + 2 * 86_400_000);
    contracts = [
      contractRow({ effectiveAt: new Date(Date.now() + 9 * 86_400_000) }),
      contractRow({ id: 'c-2', effectiveAt: soon }),
    ];

    await expect(service.createPass(user)).rejects.toMatchObject({
      response: {
        code: 'CHECK_IN_NOT_ALLOWED',
        details: { reason: 'CONTRACT_NOT_STARTED', effectiveAt: soon },
      },
    });
  });

  it('issues when one of several contracts has started', async () => {
    contracts = [
      contractRow({ effectiveAt: new Date(Date.now() + 9 * 86_400_000) }),
      contractRow({ id: 'c-2' }),
    ];

    await expect(service.createPass(user)).resolves.toMatchObject({ id: 'pass-1' });
  });
});
