import type { AuthUser } from '@modules/auth/types/auth-user';
import { AccessPassService } from './access-pass.service';
import { parsePayload } from './check-in-eligibility';

const user = { id: 'cust-1' } as AuthUser;

describe('AccessPassService.createPass', () => {
  let contracts: { id: string; effectiveAt: Date }[];
  let overdue: { invoiceNo: string }[];
  let em: { query: jest.Mock };
  let order: string[];
  let service: AccessPassService;

  beforeEach(() => {
    order = [];
    contracts = [{ id: 'c-1', effectiveAt: new Date('2020-01-01T00:00:00Z') }];
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

  it('issues a customer pass: raw token only in the payload, sha256 stored, ttl from setting', async () => {
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

  it('looks for shelf contracts in any warehouse', async () => {
    await service.createPass(user);

    const lookup = em.query.mock.calls.find(([sql]) => sql.includes('FROM "contracts"'));
    expect(lookup?.[0]).not.toContain('"parent_id"');
    expect(lookup?.[1]).toEqual(['cust-1']);
  });

  it('refuses with the overdue invoice numbers and issues nothing', async () => {
    overdue = [{ invoiceNo: 'INV-9' }];

    await expect(service.createPass(user)).rejects.toMatchObject({
      status: 409,
      response: { code: 'INVOICE_OVERDUE', details: { invoiceNos: ['INV-9'] } },
    });
    expect(order).toEqual(['lock']);
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
      { id: 'c-1', effectiveAt: new Date(Date.now() + 9 * 86_400_000) },
      { id: 'c-2', effectiveAt: soon },
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
      { id: 'c-1', effectiveAt: new Date(Date.now() + 9 * 86_400_000) },
      { id: 'c-2', effectiveAt: new Date('2020-01-01T00:00:00Z') },
    ];

    await expect(service.createPass(user)).resolves.toMatchObject({ id: 'pass-1' });
  });
});
