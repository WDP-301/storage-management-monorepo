import { AppUser } from '@entities/app-user.entity';
import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { hashSessionToken } from '@modules/auth/session.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { StorageUnitKind, UserRole } from '@storage/types';
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
  let contracts: { id: string; effectiveAt: Date }[];
  let warehouse: Record<string, unknown> | null;
  let openVisit: Record<string, unknown> | null;
  let em: { query: jest.Mock; find: jest.Mock; findOne: jest.Mock };
  let notifications: { createForUsers: jest.Mock };
  let service: CheckInService;

  const updated = () => em.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'));
  const passLookups = () =>
    em.query.mock.calls.filter(([sql]) => sql.includes('"qr_token_hash" = $1'));
  const passUpdate = () =>
    em.query.mock.calls.find(([sql]) => sql.includes('"verified_by" = $2')) as [string, unknown[]];
  const visitCloses = () =>
    em.query.mock.calls.filter(([sql]) => sql.includes('SET "checked_out_at"'));

  beforeEach(() => {
    pass = { id: 'p-1', customerId: 'cust-1', usedAt: null, verifiedBy: null, expired: false };
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
    openVisit = null;
    contracts = [{ id: 'c-1', effectiveAt: new Date('2020-01-01T00:00:00Z') }];
    warehouse = {
      id: 'w-1',
      code: 'W-1',
      name: 'Warehouse 1',
      kind: StorageUnitKind.SHELF_WAREHOUSE,
      facilityId: 'f-1',
    };
    em = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM "user_role_assignments"'))
          return [{ userId: 'fm-1', facilityId: 'f-2' }];
        if (sql.includes('ANY($1::uuid[])')) {
          return [
            {
              id: 'v-0',
              facilityId: 'f-2',
              customerName: 'An',
              warehouseCode: 'W-2',
              usedAt: new Date(),
            },
          ];
        }
        if (sql.startsWith('SELECT') && sql.includes('"checked_out_at" IS NULL')) {
          return openVisit ? [openVisit] : [];
        }
        if (sql.includes('"qr_token_hash" = $1')) return pass ? [pass] : [];
        if (sql.includes('FROM "contracts"')) return contracts;
        if (sql.includes('FROM "invoices"')) return overdue;
        // The postgres driver returns UPDATE … RETURNING as [rows, affectedCount].
        return [[{ usedAt: new Date('2026-03-01T10:00:00Z') }], 1];
      }),
      find: jest.fn(async (entity) => (entity === UserRoleAssignment ? assignments : [])),
      findOne: jest.fn(async (entity, options) => {
        if (entity === StorageUnit) {
          return options.where.id === 'w-1' &&
            options.where.kind === StorageUnitKind.SHELF_WAREHOUSE
            ? warehouse
            : null;
        }
        if (entity === Facility) return { code: 'F-1', name: 'HCM' };
        if (entity === AppUser) return { fullName: 'An', phone: '0900' };
        return null;
      }),
    };
    notifications = { createForUsers: jest.fn(async () => 1) };
    service = new CheckInService(
      { transaction: jest.fn((cb) => cb(em)) } as never,
      notifications as never,
    );
  });

  const reason = (r: string) => ({
    status: 409,
    response: { code: 'ACCESS_PASS_INVALID', details: expect.objectContaining({ reason: r }) },
  });

  it('rejects a malformed payload without touching the database', async () => {
    await expect(service.verify(staff, 'nonsense', 'w-1')).rejects.toMatchObject(
      reason('MALFORMED'),
    );
    expect(em.query).not.toHaveBeenCalled();
    expect(em.findOne).not.toHaveBeenCalled();
  });

  it('looks the pass up by token hash, locked', async () => {
    await service.verify(staff, payload, 'w-1');

    const [[sql, params]] = passLookups();
    expect(sql).toContain('FOR UPDATE');
    expect(params).toEqual([hashSessionToken(token)]);
  });

  it('judges expiry and stamps use by the wall clock, not the transaction start', async () => {
    await service.verify(staff, `${payload}\r\n`, 'w-1');

    const sqls = em.query.mock.calls.map(([sql]) => sql as string);
    expect(passLookups()[0][0]).toContain('"expires_at" <= clock_timestamp()');
    expect(sqls.find((sql) => sql.startsWith('UPDATE'))).toContain('"used_at" = clock_timestamp()');
    expect(sqls.join('\n')).not.toContain('now()');
  });

  it('rejects an unknown pass', async () => {
    pass = null;
    await expect(service.verify(staff, payload, 'w-1')).rejects.toMatchObject(reason('NOT_FOUND'));
  });

  it('answers 404 for an unknown warehouse or one that is not a shelf warehouse', async () => {
    await expect(service.verify(staff, payload, 'w-9')).rejects.toMatchObject({ status: 404 });
    expect(passLookups()).toHaveLength(0);
  });

  it('consumes the pass, records the warehouse and returns the entry view', async () => {
    const result = await service.verify(staff, payload, 'w-1');

    expect(passUpdate()[1]).toEqual(['p-1', 'staff-1', 'w-1', 'f-1', 'CHECK_IN']);
    expect(visitCloses()).toHaveLength(0);
    expect(result).toEqual({
      eventId: 'p-1',
      usedAt: new Date('2026-03-01T10:00:00Z'),
      customer: { fullName: 'An', phone: '0900' },
      warehouse: { code: 'W-1', name: 'Warehouse 1' },
      facility: { code: 'F-1', name: 'HCM' },
      direction: 'IN',
      checkedInAt: null,
    });
  });

  it('looks for the customer shelf contracts inside the chosen warehouse', async () => {
    await service.verify(staff, payload, 'w-1');

    const lookup = em.query.mock.calls.find(([sql]) => sql.includes('FROM "contracts"'));
    expect(lookup?.[0]).toContain('u."parent_id" = $2');
    expect(lookup?.[1]).toEqual(['cust-1', 'w-1']);
  });

  it('refuses a customer without a shelf in this warehouse and leaves the pass unused', async () => {
    contracts = [];

    await expect(service.verify(staff, payload, 'w-1')).rejects.toMatchObject({
      response: { code: 'CHECK_IN_NOT_ALLOWED', details: { reason: 'NO_SHELF_CONTRACT' } },
    });
    expect(updated()).toBe(false);
  });

  it('refuses staff of another facility before reading the pass', async () => {
    warehouse = { ...warehouse, facilityId: 'f-2' };
    await expect(service.verify(staff, payload, 'w-1')).rejects.toMatchObject({ status: 403 });
    expect(passLookups()).toHaveLength(0);
  });

  it('refuses staff whose assignment has ended', async () => {
    assignments = [{ ...assignments[0], endsAt: new Date('2021-01-01T00:00:00Z') }];
    await expect(service.verify(staff, payload, 'w-1')).rejects.toMatchObject({ status: 403 });
  });

  it('lets an ADMIN without any assignment scan', async () => {
    assignments = [];
    await expect(
      service.verify(actor('a-1', [UserRole.ADMIN]), payload, 'w-1'),
    ).resolves.toBeDefined();
  });

  it('reports a used pass with who used it', async () => {
    const usedAt = new Date('2026-03-01T09:00:00Z');
    pass = { ...pass, usedAt, verifiedBy: 'staff-1' };

    await expect(service.verify(staff, payload, 'w-1')).rejects.toMatchObject({
      response: { details: { reason: 'USED', usedAt, verifiedByMe: true } },
    });
    expect(updated()).toBe(false);
  });

  it('reports an expired pass', async () => {
    pass = { ...pass, expired: true };
    await expect(service.verify(staff, payload, 'w-1')).rejects.toMatchObject(reason('EXPIRED'));
  });

  it('refuses an overdue customer and leaves the pass unused', async () => {
    overdue = [{ invoiceNo: 'INV-1' }];

    await expect(service.verify(staff, payload, 'w-1')).rejects.toMatchObject({
      response: { code: 'INVOICE_OVERDUE', details: { invoiceNos: ['INV-1'] } },
    });
    expect(updated()).toBe(false);
  });

  it('refuses before the contract in this warehouse starts', async () => {
    contracts = [{ id: 'c-1', effectiveAt: new Date(Date.now() + 5 * 86_400_000) }];

    await expect(service.verify(staff, payload, 'w-1')).rejects.toMatchObject({
      response: { code: 'CHECK_IN_NOT_ALLOWED', details: { reason: 'CONTRACT_NOT_STARTED' } },
    });
    expect(updated()).toBe(false);
  });

  describe('when the customer is inside', () => {
    const since = new Date('2026-03-01T08:00:00Z');

    it('checks out at the warehouse of the open visit, linking the exit scan', async () => {
      openVisit = { id: 'v-1', warehouseId: 'w-1', facilityId: 'f-1', usedAt: since };

      const result = await service.verify(staff, payload, 'w-1');

      expect(passUpdate()[1]).toEqual(['p-1', 'staff-1', 'w-1', 'f-1', 'CHECK_OUT']);
      const [[sql, params]] = visitCloses();
      expect(sql).toContain('"checked_out_at" IS NULL');
      expect(params).toEqual(['v-1', 'staff-1', 'SCAN', null, 'p-1']);
      expect(result).toMatchObject({ direction: 'OUT', checkedInAt: since });
    });

    it('locks the open visit before deciding the direction', async () => {
      openVisit = { id: 'v-1', warehouseId: 'w-1', facilityId: 'f-1', usedAt: since };
      await service.verify(staff, payload, 'w-1');

      const lookup = em.query.mock.calls.find(
        ([sql]) => sql.startsWith('SELECT') && sql.includes('"checked_out_at" IS NULL'),
      );
      expect(lookup?.[0]).toContain('FOR UPDATE');
      expect(lookup?.[1]).toEqual(['cust-1']);
    });

    it('never refuses an exit, even with overdue invoices or no contract left', async () => {
      openVisit = { id: 'v-1', warehouseId: 'w-1', facilityId: 'f-1', usedAt: since };
      overdue = [{ invoiceNo: 'INV-1' }];
      contracts = [];

      await expect(service.verify(staff, payload, 'w-1')).resolves.toMatchObject({
        direction: 'OUT',
      });
    });

    it('entering another warehouse closes the forgotten visit and tells its managers', async () => {
      openVisit = { id: 'v-0', warehouseId: 'w-2', facilityId: 'f-2', usedAt: since };

      const result = await service.verify(staff, payload, 'w-1');

      const [[, params]] = visitCloses();
      expect(params).toEqual(['v-0', null, 'AUTO', 'Checked in at another warehouse', null]);
      expect(notifications.createForUsers).toHaveBeenCalledWith(
        em,
        ['fm-1'],
        expect.objectContaining({
          type: 'CHECK_OUT_MISSED',
          data: expect.objectContaining({ visitId: 'v-0' }),
        }),
      );
      expect(passUpdate()[1]).toEqual(['p-1', 'staff-1', 'w-1', 'f-1', 'CHECK_IN']);
      expect(result.direction).toBe('IN');
    });

    it('keeps the other visit open when the new entry is refused', async () => {
      openVisit = { id: 'v-0', warehouseId: 'w-2', facilityId: 'f-2', usedAt: since };
      overdue = [{ invoiceNo: 'INV-1' }];

      await expect(service.verify(staff, payload, 'w-1')).rejects.toMatchObject({
        response: { code: 'INVOICE_OVERDUE' },
      });
      expect(updated()).toBe(false);
    });
  });
});
