import { StorageUnit } from '@entities/storage-unit.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { StorageUnitKind, UserRole } from '@storage/types';
import { VisitsService } from './visits.service';

const staff = { id: 'staff-1', roles: [UserRole.FACILITY_STAFF] } as AuthUser;
const customer = { id: 'cust-1', roles: [UserRole.CUSTOMER] } as AuthUser;

const row = (over: Record<string, unknown> = {}) => ({
  id: 'v-1',
  checkedInAt: new Date('2026-10-23T03:00:00Z'),
  checkedOutAt: null,
  checkOutMethod: null,
  checkOutNote: null,
  customerName: 'An',
  customerPhone: '0900',
  warehouseId: 'w-1',
  warehouseCode: 'W-1',
  warehouseName: 'Kho 1',
  facilityCode: 'F-1',
  facilityName: 'HCM',
  ...over,
});

describe('VisitsService', () => {
  let visit: Record<string, unknown> | null;
  let rows: Record<string, unknown>[];
  let assignments: Record<string, unknown>[];
  let em: { query: jest.Mock; find: jest.Mock; findOne: jest.Mock };
  let service: VisitsService;

  beforeEach(() => {
    visit = { id: 'v-1', facilityId: 'f-1', open: true };
    rows = [row()];
    assignments = [
      {
        userId: 'staff-1',
        role: UserRole.FACILITY_STAFF,
        facilityId: 'f-1',
        startsAt: new Date('2020-01-01T00:00:00Z'),
        endsAt: null,
      },
    ];
    em = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FOR UPDATE')) return visit ? [visit] : [];
        if (sql.startsWith('UPDATE')) return [[{ checkedOutAt: new Date() }], 1];
        return rows;
      }),
      find: jest.fn(async (entity) => (entity === UserRoleAssignment ? assignments : [])),
      findOne: jest.fn(async (entity, options) =>
        entity === StorageUnit && options.where.id === 'w-1'
          ? { id: 'w-1', kind: StorageUnitKind.SHELF_WAREHOUSE, facilityId: 'f-1' }
          : null,
      ),
    };
    service = new VisitsService({
      manager: em,
      transaction: jest.fn((cb) => cb(em)),
    } as never);
  });

  describe('checkOutManually', () => {
    it('closes the open visit as MANUAL with the trimmed note', async () => {
      await service.checkOutManually(staff, 'v-1', '  Khách hết pin  ');

      const update = em.query.mock.calls.find(([sql]) => sql.startsWith('UPDATE')) as [
        string,
        unknown[],
      ];
      expect(update[1]).toEqual(['v-1', 'staff-1', 'MANUAL', 'Khách hết pin', null]);
    });

    it('refuses a visit that is already checked out', async () => {
      visit = { ...visit, open: false };
      await expect(service.checkOutManually(staff, 'v-1', 'x')).rejects.toMatchObject({
        status: 409,
        response: { details: { reason: 'ALREADY_CHECKED_OUT' } },
      });
    });

    it('refuses staff of another facility', async () => {
      visit = { ...visit, facilityId: 'f-2' };
      await expect(service.checkOutManually(staff, 'v-1', 'x')).rejects.toMatchObject({
        status: 403,
      });
      expect(em.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
    });

    it('answers 404 for an unknown visit', async () => {
      visit = null;
      await expect(service.checkOutManually(staff, 'v-9', 'x')).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('listInside', () => {
    it('lists open visits of the warehouse for staff working there', async () => {
      const inside = await service.listInside(staff, 'w-1');

      const [[sql, params]] = em.query.mock.calls;
      expect(sql).toContain('"checked_out_at" IS NULL');
      expect(params).toEqual(['w-1']);
      expect(inside[0]).toMatchObject({ id: 'v-1', warehouse: { code: 'W-1' } });
    });

    it('refuses staff of another facility', async () => {
      assignments = [];
      await expect(service.listInside(staff, 'w-1')).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('mine', () => {
    it('returns the open visit as current alongside the recent ones', async () => {
      rows = [row(), row({ id: 'v-0', checkedOutAt: new Date(), checkOutMethod: 'SCAN' })];

      const result = await service.mine(customer);

      expect(result.current?.id).toBe('v-1');
      expect(result.recent).toHaveLength(2);
      expect(em.query.mock.calls[0][1]).toEqual(['cust-1', 10]);
    });

    it('has no current visit when every visit is closed', async () => {
      rows = [row({ checkedOutAt: new Date(), checkOutMethod: 'AUTO' })];
      await expect(service.mine(customer)).resolves.toMatchObject({ current: null });
    });
  });
});
