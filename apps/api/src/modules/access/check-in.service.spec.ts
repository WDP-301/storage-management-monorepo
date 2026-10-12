import { AppUser } from '@entities/app-user.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { hashSessionToken } from '@modules/auth/session.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { ContractStatus, StorageUnitKind, UserRole } from '@storage/types';
import { CheckInService } from './check-in.service';
import { buildPayload } from './check-in-eligibility';

const token = 'B'.repeat(43);
const payload = buildPayload(token);
const actor = (id: string, roles: UserRole[]) => ({ id, roles }) as AuthUser;
const staff = actor('staff-1', [UserRole.FACILITY_STAFF]);

describe('CheckInService.verify', () => {
  let pass: Record<string, unknown> | null;
  let assignments: Record<string, unknown>[];
  let overdue: { invoiceNo: string }[];
  let contract: Record<string, unknown>;
  let unit: Record<string, unknown>;
  let em: { query: jest.Mock; find: jest.Mock; findOne: jest.Mock };
  let service: CheckInService;

  const updated = () => em.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'));

  beforeEach(() => {
    pass = {
      id: 'p-1',
      contractId: 'c-1',
      storageUnitId: 'u-1',
      facilityId: 'f-1',
      usedAt: null,
      verifiedBy: null,
      expired: false,
    };
    assignments = [
      {
        userId: 'staff-1',
        role: UserRole.FACILITY_STAFF,
        facilityId: 'f-1',
        startsAt: new Date('2020-01-01T00:00:00Z'),
        endsAt: null,
      },
    ];
    overdue = [];
    contract = {
      id: 'c-1',
      contractNo: 'CT-1',
      customerId: 'cust-1',
      bookingItemId: 'bi-1',
      status: ContractStatus.ACTIVE,
      effectiveAt: new Date('2020-01-01T00:00:00Z'),
      endedAt: null,
    };
    unit = {
      id: 'u-1',
      code: 'S-1',
      name: 'Shelf 1',
      kind: StorageUnitKind.SHELF,
      facilityId: 'f-1',
      parentId: 'w-1',
    };
    em = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM "access_events"')) return pass ? [pass] : [];
        if (sql.includes('FROM "invoices"')) return overdue;
        // The postgres driver returns UPDATE … RETURNING as [rows, affectedCount].
        return [[{ usedAt: new Date('2026-03-01T10:00:00Z') }], 1];
      }),
      find: jest.fn(async (entity) => (entity === UserRoleAssignment ? assignments : [])),
      findOne: jest.fn(async (entity, options) => {
        if (entity === Contract) return contract;
        if (entity === BookingItem) return { storageUnitId: 'u-1' };
        if (entity === StorageUnit) {
          return options.where.id === 'w-1' ? { code: 'W-1', name: 'Warehouse 1' } : unit;
        }
        if (entity === Facility) return { code: 'F-1', name: 'HCM' };
        if (entity === AppUser) return { fullName: 'An', phone: '0900' };
        return null;
      }),
    };
    service = new CheckInService({ transaction: jest.fn((cb) => cb(em)) } as never);
  });

  const reason = (r: string) => ({
    status: 409,
    response: { code: 'ACCESS_PASS_INVALID', details: expect.objectContaining({ reason: r }) },
  });

  it('rejects a malformed payload without touching the database', async () => {
    await expect(service.verify(staff, 'nonsense')).rejects.toMatchObject(reason('MALFORMED'));
    expect(em.query).not.toHaveBeenCalled();
  });

  it('looks the pass up by token hash, locked', async () => {
    await service.verify(staff, payload);

    const [sql, params] = em.query.mock.calls[0];
    expect(sql).toContain('FOR UPDATE');
    expect(params).toEqual([hashSessionToken(token)]);
  });

  it('rejects an unknown pass', async () => {
    pass = null;
    await expect(service.verify(staff, payload)).rejects.toMatchObject(reason('NOT_FOUND'));
  });

  it('consumes the pass and returns the entry view', async () => {
    const result = await service.verify(staff, payload);

    const update = em.query.mock.calls.find(([sql]) => sql.startsWith('UPDATE')) as [
      string,
      unknown[],
    ];
    expect(update[1]).toEqual(['p-1', 'staff-1']);
    expect(result).toEqual({
      eventId: 'p-1',
      usedAt: new Date('2026-03-01T10:00:00Z'),
      customer: { fullName: 'An', phone: '0900' },
      contract: { id: 'c-1', contractNo: 'CT-1', endedAt: null },
      unit: { code: 'S-1', name: 'Shelf 1' },
      warehouse: { code: 'W-1', name: 'Warehouse 1' },
      facility: { code: 'F-1', name: 'HCM' },
    });
  });

  it('refuses staff of another facility before reporting pass state', async () => {
    pass = { ...pass, facilityId: 'f-2', usedAt: new Date() };
    await expect(service.verify(staff, payload)).rejects.toMatchObject({ status: 403 });
  });

  it('refuses staff whose assignment has ended', async () => {
    assignments = [{ ...assignments[0], endsAt: new Date('2021-01-01T00:00:00Z') }];
    await expect(service.verify(staff, payload)).rejects.toMatchObject({ status: 403 });
  });

  it('lets an ADMIN without any assignment scan', async () => {
    assignments = [];
    await expect(service.verify(actor('a-1', [UserRole.ADMIN]), payload)).resolves.toBeDefined();
  });

  it('reports a used pass with who used it', async () => {
    const usedAt = new Date('2026-03-01T09:00:00Z');
    pass = { ...pass, usedAt, verifiedBy: 'staff-1' };

    await expect(service.verify(staff, payload)).rejects.toMatchObject({
      response: { details: { reason: 'USED', usedAt, verifiedByMe: true } },
    });
    expect(updated()).toBe(false);
  });

  it('reports an expired pass', async () => {
    pass = { ...pass, expired: true };
    await expect(service.verify(staff, payload)).rejects.toMatchObject(reason('EXPIRED'));
  });

  it('refuses when the contract moved to another shelf after the pass was issued', async () => {
    unit = { ...unit, id: 'u-2' };
    await expect(service.verify(staff, payload)).rejects.toMatchObject(reason('NOT_FOUND'));
    expect(updated()).toBe(false);
  });

  it('refuses an overdue customer and leaves the pass unused', async () => {
    overdue = [{ invoiceNo: 'INV-1' }];

    await expect(service.verify(staff, payload)).rejects.toMatchObject({
      response: { code: 'INVOICE_OVERDUE', details: { invoiceNos: ['INV-1'] } },
    });
    expect(updated()).toBe(false);
  });

  it('refuses a contract that is no longer ACTIVE', async () => {
    contract = { ...contract, status: ContractStatus.ENDED };

    await expect(service.verify(staff, payload)).rejects.toMatchObject({
      response: { code: 'CHECK_IN_NOT_ALLOWED', details: { reason: 'CONTRACT_NOT_ACTIVE' } },
    });
    expect(updated()).toBe(false);
  });
});
