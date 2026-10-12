import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { ContractStatus, StorageUnitKind } from '@storage/types';
import { AccessPassService } from './access-pass.service';
import { parsePayload } from './check-in-eligibility';

const user = { id: 'cust-1' } as AuthUser;

describe('AccessPassService.createPass', () => {
  let contract: Record<string, unknown> | null;
  let unit: Record<string, unknown>;
  let overdue: { invoiceNo: string }[];
  let em: { findOne: jest.Mock; query: jest.Mock };
  let order: string[];
  let service: AccessPassService;

  beforeEach(() => {
    order = [];
    contract = {
      id: 'c-1',
      contractNo: 'CT-1',
      customerId: 'cust-1',
      bookingItemId: 'bi-1',
      status: ContractStatus.ACTIVE,
      effectiveAt: new Date('2020-01-01T00:00:00Z'),
      endedAt: new Date('2021-01-01T00:00:00Z'),
    };
    unit = {
      id: 'u-1',
      code: 'S-1',
      name: 'Shelf 1',
      kind: StorageUnitKind.SHELF,
      facilityId: 'f-1',
    };
    overdue = [];
    em = {
      findOne: jest.fn(async (entity, options) => {
        if (entity === Contract) {
          order.push('lock');
          return options.where.customerId === 'cust-1' ? contract : null;
        }
        if (entity === BookingItem) return { storageUnit: unit };
        return null;
      }),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM "invoices"')) return overdue;
        if (sql.startsWith('UPDATE')) {
          order.push('expire');
          return [];
        }
        order.push('insert');
        return [{ id: 'pass-1', expires_at: new Date(Date.now() + 600_000) }];
      }),
    };
    const dataSource = { transaction: jest.fn((cb) => cb(em)) };
    const settings = { getCheckInQrTtlMinutes: jest.fn().mockResolvedValue(10) };
    service = new AccessPassService(dataSource as never, settings as never);
  });

  it('issues a pass: raw token only in the payload, sha256 stored, ttl from setting', async () => {
    const result = await service.createPass(user, 'c-1');

    const insert = em.query.mock.calls.find(([sql]) => sql.startsWith('INSERT'));
    const [, params] = insert as [string, unknown[]];
    const token = parsePayload(result.qrPayload) as string;
    expect(token).toHaveLength(43);
    expect(params[2]).toMatch(/^[0-9a-f]{64}$/);
    expect(params).not.toContain(token);
    expect(params.slice(3)).toEqual(['u-1', 'f-1', 10]);
    expect(result.ttlSeconds).toBeGreaterThan(595);
    expect(result).toMatchObject({
      id: 'pass-1',
      contract: { id: 'c-1', contractNo: 'CT-1' },
      unit: { code: 'S-1', name: 'Shelf 1' },
    });
  });

  it('locks the contract, then expires older passes, then inserts', async () => {
    await service.createPass(user, 'c-1');

    expect(em.findOne.mock.calls[0][1].lock).toEqual({ mode: 'pessimistic_write' });
    expect(order).toEqual(['lock', 'expire', 'insert']);
  });

  it("answers 404 for another customer's contract", async () => {
    await expect(service.createPass({ id: 'other' } as AuthUser, 'c-1')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('refuses with the overdue invoice numbers and issues nothing', async () => {
    overdue = [{ invoiceNo: 'INV-9' }];

    await expect(service.createPass(user, 'c-1')).rejects.toMatchObject({
      status: 409,
      response: { code: 'INVOICE_OVERDUE', details: { invoiceNos: ['INV-9'] } },
    });
    expect(order).toEqual(['lock']);
  });

  it('refuses a self-storage contract', async () => {
    unit.kind = StorageUnitKind.SELF_STORAGE;

    await expect(service.createPass(user, 'c-1')).rejects.toMatchObject({
      response: { code: 'CHECK_IN_NOT_ALLOWED', details: { reason: 'NOT_SHELF' } },
    });
  });

  it('refuses before effectiveAt', async () => {
    contract = { ...contract, effectiveAt: new Date(Date.now() + 86_400_000) };

    await expect(service.createPass(user, 'c-1')).rejects.toMatchObject({
      response: { code: 'CHECK_IN_NOT_ALLOWED', details: { reason: 'CONTRACT_NOT_STARTED' } },
    });
  });

  it('refuses a contract that is not ACTIVE (status re-checked under the lock)', async () => {
    contract = { ...contract, status: ContractStatus.ENDED };

    await expect(service.createPass(user, 'c-1')).rejects.toMatchObject({
      response: { code: 'CHECK_IN_NOT_ALLOWED', details: { reason: 'CONTRACT_NOT_ACTIVE' } },
    });
  });

  it('still issues a pass for an ACTIVE contract past endedAt', async () => {
    await expect(service.createPass(user, 'c-1')).resolves.toMatchObject({ id: 'pass-1' });
  });
});
