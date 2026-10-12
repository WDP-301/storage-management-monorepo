import { Facility } from '@entities/facility.entity';
import { ShelfLayout } from '@entities/shelf-layout.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { StorageUnitKind, StorageUnitStatus, UserRole } from '@storage/types';
import type { WarehouseView } from '../warehouse.view';
import { LayoutService } from './layout.service';

const SHELF_1 = '11111111-1111-4111-8111-111111111111';
const SHELF_2 = '22222222-2222-4222-8222-222222222222';

const admin = { id: 'admin-1', roles: [UserRole.ADMIN] } as AuthUser;
const manager1 = { id: 'fm-1', roles: [UserRole.FACILITY_MANAGER] } as AuthUser;
const staff = { id: 'staff-1', roles: [UserRole.FACILITY_STAFF] } as AuthUser;

const parent = {
  id: 'wh-1',
  code: 'KK1',
  facilityId: 'fac-1',
  kind: StorageUnitKind.SHELF_WAREHOUSE,
} as StorageUnit;

const dto = (over: object = {}) =>
  ({
    rows: 3,
    cols: 4,
    version: 0,
    elements: [{ type: 'LABEL', row: 0, col: 0, rowSpan: 1, colSpan: 1, text: '  Dãy A ' }],
    placements: [{ shelfId: SHELF_1, row: 1, col: 1, rowSpan: 1, colSpan: 1 }],
    ...over,
  }) as never;

const view = (id: string, status: StorageUnitStatus = StorageUnitStatus.AVAILABLE) =>
  ({ id, status, code: id }) as unknown as WarehouseView;

const stored = (over: Partial<ShelfLayout> = {}) =>
  ({
    warehouseId: 'wh-1',
    rows: 3,
    cols: 4,
    version: 2,
    elements: [],
    placements: [{ shelfId: SHELF_1, row: 0, col: 0, rowSpan: 1, colSpan: 1 }],
    updatedBy: 'admin-1',
    updatedAt: new Date(0),
    ...over,
  }) as ShelfLayout;

describe('LayoutService', () => {
  let em: Record<'findOne' | 'find' | 'update' | 'insert' | 'delete' | 'transaction', jest.Mock>;
  let layouts: { findOne: jest.Mock };
  let query: { listShelves: jest.Mock };
  let calls: string[];
  let locked: ShelfLayout | null;
  let unit: StorageUnit | null;
  let service: LayoutService;

  beforeEach(() => {
    calls = [];
    locked = null;
    unit = parent;
    em = {
      findOne: jest.fn(async (entity: unknown, options: { lock?: unknown }) => {
        if (entity === Facility) {
          calls.push('facility');
          return { id: 'fac-1' };
        }
        if (entity === ShelfLayout) {
          calls.push('layout');
          return locked;
        }
        calls.push(options.lock ? 'parent:locked' : 'parent');
        return unit;
      }),
      find: jest.fn(async (entity: unknown) =>
        entity === UserRoleAssignment
          ? [{ startsAt: new Date(0), endsAt: null }]
          : [
              { id: SHELF_1, code: 'KK1-A-01' },
              { id: SHELF_2, code: 'KK1-A-02' },
            ],
      ),
      update: jest.fn().mockResolvedValue(undefined),
      insert: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      transaction: jest.fn((work) => work(em)),
    };
    layouts = { findOne: jest.fn().mockResolvedValue(null) };
    query = { listShelves: jest.fn().mockResolvedValue([view(SHELF_1), view(SHELF_2)]) };
    service = new LayoutService(layouts as never, { manager: em } as never, query as never);
  });

  describe('getLayout', () => {
    it('answers an empty plan with every shelf unplaced when none is drawn', async () => {
      const result = await service.getLayout('wh-1');

      expect(result).toMatchObject({ warehouseId: 'wh-1', layout: null, placed: [] });
      expect(result.unplaced.map((s) => s.id)).toEqual([SHELF_1, SHELF_2]);
      expect(query.listShelves).toHaveBeenCalledWith('wh-1', {
        includeInactive: true,
        actor: undefined,
      });
    });

    it('drops a placement whose shelf no longer exists', async () => {
      layouts.findOne.mockResolvedValue(
        stored({
          placements: [
            { shelfId: 'deleted', row: 0, col: 0, rowSpan: 1, colSpan: 1 },
            { shelfId: SHELF_1, row: 1, col: 1, rowSpan: 1, colSpan: 2 },
          ],
        }),
      );

      const result = await service.getLayout('wh-1');

      expect(result.placed).toEqual([
        { shelf: expect.objectContaining({ id: SHELF_1 }), row: 1, col: 1, rowSpan: 1, colSpan: 2 },
      ]);
      expect(result.unplaced.map((s) => s.id)).toEqual([SHELF_2]);
      expect(result.layout).toMatchObject({ version: 2 });
      expect(result.layout).not.toHaveProperty('updatedBy');
    });

    it('shows a placed retired shelf publicly but hides an unplaced one', async () => {
      query.listShelves.mockResolvedValue([
        view(SHELF_1, StorageUnitStatus.INACTIVE),
        view(SHELF_2, StorageUnitStatus.INACTIVE),
      ]);
      layouts.findOne.mockResolvedValue(stored());

      const result = await service.getLayout('wh-1');

      expect(result.placed.map((p) => p.shelf.id)).toEqual([SHELF_1]);
      expect(result.unplaced).toEqual([]);
    });

    it('keeps retired unplaced shelves and the last editor for back office', async () => {
      query.listShelves.mockResolvedValue([view(SHELF_2, StorageUnitStatus.INACTIVE)]);
      layouts.findOne.mockResolvedValue(stored());

      const result = await service.getLayout('wh-1', admin);

      expect(result.unplaced.map((s) => s.id)).toEqual([SHELF_2]);
      expect(result.layout?.updatedBy).toBe('admin-1');
      expect(query.listShelves).toHaveBeenCalledWith('wh-1', {
        includeInactive: true,
        actor: admin,
      });
    });
  });

  describe('save', () => {
    beforeEach(() => {
      layouts.findOne.mockResolvedValue(stored());
    });

    it('creates version 1 from version 0, locking facility, parent, then layout', async () => {
      await service.save('wh-1', dto(), admin);

      expect(calls).toEqual(['parent', 'facility', 'parent:locked', 'layout']);
      expect(em.insert).toHaveBeenCalledWith(
        ShelfLayout,
        expect.objectContaining({
          warehouseId: 'wh-1',
          version: 1,
          updatedBy: 'admin-1',
          elements: [{ type: 'LABEL', row: 0, col: 0, rowSpan: 1, colSpan: 1, text: 'Dãy A' }],
        }),
      );
      expect(em.update).not.toHaveBeenCalled();
    });

    it('updates to version+1 when the editor holds the current version', async () => {
      locked = stored({ version: 2 });

      await service.save('wh-1', dto({ version: 2 }), admin);

      expect(em.update).toHaveBeenCalledWith(
        ShelfLayout,
        { warehouseId: 'wh-1' },
        expect.objectContaining({ version: 3, updatedBy: 'admin-1', rows: 3, cols: 4 }),
      );
      expect(em.insert).not.toHaveBeenCalled();
    });

    it.each([
      ['a stale version', stored({ version: 5 }), 2, 5],
      ['version 0 over an existing layout', stored({ version: 5 }), 0, 5],
      ['a version over a missing layout', null, 3, 0],
    ])('answers 409 with the current version for %s', async (_name, row, sent, current) => {
      locked = row;

      await expect(service.save('wh-1', dto({ version: sent }), admin)).rejects.toMatchObject({
        status: 409,
        response: { details: { reason: 'LAYOUT_VERSION_MISMATCH', currentVersion: current } },
      });
      expect(em.insert).not.toHaveBeenCalled();
      expect(em.update).not.toHaveBeenCalled();
    });

    it('answers the same 409 when a concurrent first save wins the primary key', async () => {
      em.insert.mockRejectedValue({ code: '23505' });
      layouts.findOne.mockResolvedValue(stored({ version: 1 }));

      await expect(service.save('wh-1', dto(), admin)).rejects.toMatchObject({
        status: 409,
        response: { details: { reason: 'LAYOUT_VERSION_MISMATCH', currentVersion: 1 } },
      });
    });

    it('rethrows other storage errors', async () => {
      em.insert.mockRejectedValue(new Error('boom'));
      await expect(service.save('wh-1', dto(), admin)).rejects.toThrow('boom');
    });

    it('answers 400 with a field per problem and stores nothing', async () => {
      const bad = dto({
        placements: [
          { shelfId: SHELF_1, row: 1, col: 1, rowSpan: 1, colSpan: 1 },
          { shelfId: SHELF_1, row: 2, col: 1, rowSpan: 1, colSpan: 1 },
          {
            shelfId: '33333333-3333-4333-8333-333333333333',
            row: 9,
            col: 9,
            rowSpan: 1,
            colSpan: 1,
          },
        ],
      });

      await expect(service.save('wh-1', bad, admin)).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: {
            fields: [
              expect.objectContaining({ field: 'placements[1]', code: 'DUPLICATE_SHELF' }),
              expect.objectContaining({ field: 'placements[2]', code: 'OUT_OF_BOUNDS' }),
              expect.objectContaining({ field: 'placements[2]', code: 'UNKNOWN_SHELF' }),
            ],
          },
        },
      });
      expect(em.insert).not.toHaveBeenCalled();
    });

    it('answers 404 for a warehouse that is not a shelf warehouse', async () => {
      unit = { ...parent, kind: StorageUnitKind.SELF_STORAGE } as StorageUnit;
      await expect(service.save('wh-1', dto(), admin)).rejects.toMatchObject({ status: 404 });
    });

    it('answers 404 for a missing warehouse', async () => {
      unit = null;
      await expect(service.save('wh-1', dto(), admin)).rejects.toMatchObject({ status: 404 });
    });

    it('lets a facility manager with an active assignment save', async () => {
      await service.save('wh-1', dto(), manager1);
      expect(em.find).toHaveBeenCalledWith(UserRoleAssignment, {
        where: { userId: 'fm-1', facilityId: 'fac-1', role: UserRole.FACILITY_MANAGER },
      });
      expect(em.insert).toHaveBeenCalled();
    });

    it.each([
      ['a manager of another facility', manager1],
      ['facility staff', staff],
    ])('forbids %s without an active assignment', async (_name, actor) => {
      em.find.mockImplementation(async (entity: unknown) =>
        entity === UserRoleAssignment ? [] : [],
      );
      await expect(service.save('wh-1', dto(), actor)).rejects.toMatchObject({ status: 403 });
      expect(em.insert).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the layout at the matching version', async () => {
      locked = stored({ version: 2 });
      await service.remove('wh-1', 2, admin);
      expect(em.delete).toHaveBeenCalledWith(ShelfLayout, { warehouseId: 'wh-1' });
    });

    it('answers 404 when there is no layout to delete', async () => {
      await expect(service.remove('wh-1', 0, admin)).rejects.toMatchObject({ status: 404 });
      expect(em.delete).not.toHaveBeenCalled();
    });

    it('answers 409 for a stale version', async () => {
      locked = stored({ version: 4 });
      await expect(service.remove('wh-1', 2, admin)).rejects.toMatchObject({
        status: 409,
        response: { details: { currentVersion: 4 } },
      });
      expect(em.delete).not.toHaveBeenCalled();
    });

    it('forbids a manager of another facility', async () => {
      em.find.mockResolvedValue([]);
      await expect(service.remove('wh-1', 2, manager1)).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('draft', () => {
    it('builds a draft from the shelf codes without writing, based on version 0 with no layout', async () => {
      const draft = await service.draft('wh-1', admin);

      expect(draft.basedOnVersion).toBe(0);
      expect(draft.placements.map((p) => p.shelfId)).toEqual([SHELF_1, SHELF_2]);
      expect(em.insert).not.toHaveBeenCalled();
      expect(em.update).not.toHaveBeenCalled();
    });

    it('reports the current version of an existing layout', async () => {
      layouts.findOne.mockResolvedValue(stored({ version: 7 }));
      await expect(service.draft('wh-1', admin)).resolves.toMatchObject({ basedOnVersion: 7 });
    });

    it('answers 409 when the shelves need more rows than the grid has', async () => {
      em.find.mockImplementation(async (entity: unknown) =>
        entity === UserRoleAssignment
          ? []
          : Array.from({ length: 51 }, (_, i) => ({ id: `s${i}`, code: `KK1-P${i}-1` })),
      );
      await expect(service.draft('wh-1', admin)).rejects.toMatchObject({ status: 409 });
    });

    it('answers 404 for a non-shelf warehouse and 403 for a foreign manager', async () => {
      unit = { ...parent, kind: StorageUnitKind.SELF_STORAGE } as StorageUnit;
      await expect(service.draft('wh-1', admin)).rejects.toMatchObject({ status: 404 });

      unit = parent;
      em.find.mockResolvedValue([]);
      await expect(service.draft('wh-1', manager1)).rejects.toMatchObject({ status: 403 });
    });
  });
});
