import type { StorageUnit } from '@entities/storage-unit.entity';
import { FacilityStatus, StorageUnitKind, StorageUnitStatus, UserRole } from '@storage/types';
import { In } from 'typeorm';
import { WarehouseQueryService } from './warehouse-query.service';

const unit = {
  id: 'unit-1',
  facilityId: 'fac-1',
  facility: { id: 'fac-1', code: 'CN-HCM', name: 'Chi nhánh HCM', status: FacilityStatus.ACTIVE },
  kind: StorageUnitKind.SELF_STORAGE,
  parentId: null,
  code: 'HCM-01',
  name: 'Kho 1',
  addressLine: '1 Test',
  latitude: '10.700000',
  longitude: '106.700000',
  widthM: '5.00',
  lengthM: '8.00',
  heightM: '3.00',
  areaM2: '40.00',
  volumeM3: '120.00',
  monthlyPrice: '5000000.00',
  depositMonths: null,
  status: StorageUnitStatus.AVAILABLE,
  images: [
    { fileKey: 'uploads/1-cover.jpg', name: 'cover.jpg', mimeType: 'image/jpeg' },
    { fileKey: 'uploads/2-inside.jpg', name: 'inside.jpg', mimeType: 'image/jpeg', size: 10 },
  ],
} as unknown as StorageUnit;

type Call = [method: string, args: unknown[]];

/** Chainable query-builder double that records every call and answers the terminal ones. */
function fakeQb(results: { many?: unknown[]; one?: unknown; count?: number; raw?: unknown[] }) {
  const calls: Call[] = [];
  const qb: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_target, name: string) => {
        if (name === 'getMany') return async () => results.many ?? [];
        if (name === 'getOne') return async () => results.one ?? null;
        if (name === 'getCount') return async () => results.count ?? 0;
        if (name === 'getRawMany') return async () => results.raw ?? [];
        return (...args: unknown[]) => {
          calls.push([name, args]);
          return qb;
        };
      },
    },
  );
  const where = () =>
    calls
      .filter(([method]) => method === 'andWhere')
      .map(([, args]) => args[0] as string)
      .join('\n');
  return { qb, calls, where, called: (method: string) => calls.filter(([m]) => m === method) };
}

const parentUnit = {
  ...(unit as object),
  id: 'parent-1',
  kind: StorageUnitKind.SHELF_WAREHOUSE,
  code: 'KK1',
  monthlyPrice: '0.00',
  images: [],
} as unknown as StorageUnit;

function build(options: {
  main: ReturnType<typeof fakeQb>;
  summaryRows?: unknown[];
  assignments?: unknown[];
  parent?:
    | (Partial<Omit<StorageUnit, 'facility'>> & { facility?: Partial<StorageUnit['facility']> })
    | null;
}) {
  const summary = fakeQb({ raw: options.summaryRows });
  const units = {
    createQueryBuilder: jest.fn(() => options.main.qb),
    findOne: jest.fn().mockResolvedValue(options.parent ?? null),
    manager: { createQueryBuilder: jest.fn(() => summary.qb) },
  };
  const roleAssignments = { find: jest.fn().mockResolvedValue(options.assignments ?? []) };
  const settings = { getDepositMonthsFor: jest.fn().mockResolvedValue(2) };
  const uploads = { generatePresignedDownloadUrl: jest.fn(async (key: string) => `signed/${key}`) };
  const service = new WarehouseQueryService(
    units as never,
    roleAssignments as never,
    settings as never,
    uploads as never,
  );
  return { service, units, summary, roleAssignments };
}

describe('WarehouseQueryService', () => {
  it('returns photos in stored order, each with a presigned link', async () => {
    const { service } = build({ main: fakeQb({ one: unit }) });

    const view = await service.findOne('unit-1');

    expect(view.images).toEqual([
      {
        fileKey: 'uploads/1-cover.jpg',
        name: 'cover.jpg',
        mimeType: 'image/jpeg',
        url: 'signed/uploads/1-cover.jpg',
      },
      {
        fileKey: 'uploads/2-inside.jpg',
        name: 'inside.jpg',
        mimeType: 'image/jpeg',
        size: 10,
        url: 'signed/uploads/2-inside.jpg',
      },
    ]);
    expect(view).toMatchObject({
      kind: 'SELF_STORAGE',
      parentId: null,
      parent: null,
      shelfSummary: null,
    });
  });

  it('joins the shelf parent without a lock so a shelf detail can name its building', async () => {
    const main = fakeQb({ one: unit });
    await build({ main }).service.findOne('unit-1');

    expect(main.called('leftJoin')[0][1]).toEqual(['unit.parent', 'parent']);
    expect(main.called('addSelect')[0][1]).toEqual([['parent.id', 'parent.code', 'parent.name']]);
    expect(main.called('setLock')).toHaveLength(0);
  });

  describe('listPublic', () => {
    it('lists shelf warehouses through free shelves and never lists a shelf', async () => {
      const main = fakeQb({ many: [parentUnit], count: 1 });
      const { service } = build({
        main,
        summaryRows: [
          {
            parentId: 'parent-1',
            status: 'AVAILABLE',
            count: '18',
            minPrice: '200000',
            minArea: '1',
            maxArea: '2',
            minVolume: null,
            maxVolume: null,
          },
          { parentId: 'parent-1', status: 'RENTED', count: '1' },
          { parentId: 'parent-1', status: 'MAINTENANCE', count: '1' },
        ],
      });

      const { warehouses, meta } = await service.listPublic({
        page: 1,
        limit: 20,
        includeShelfWarehouses: true,
      });

      const sql = main.where();
      expect(sql).toContain('unit.kind = :selfKind');
      expect(sql).toContain(
        "s.parent_id = unit.id AND s.deleted_at IS NULL AND s.status = 'AVAILABLE'",
      );
      expect(sql).not.toContain("'SHELF'");
      expect(sql).not.toContain('unit.kind <> :hiddenKind');
      expect(meta.total).toBe(1);
      expect(warehouses[0].shelfSummary).toMatchObject({
        total: 20,
        available: 18,
        minMonthlyPrice: 200_000,
        statusCounts: { AVAILABLE: 18, RENTED: 1, MAINTENANCE: 1 },
        minAreaM2: 1,
        maxAreaM2: 2,
      });
    });

    it('applies price bounds to the shelves, and the same bounds to the sort and the rollup', async () => {
      const main = fakeQb({ many: [parentUnit], count: 1 });
      const { service, summary } = build({ main });

      await service.listPublic({ minPrice: 500_000, sort: 'price_asc' });

      expect(main.where()).toContain('s.monthly_price >= :minPrice');
      expect(main.where()).toContain('unit.monthlyPrice >= :minPrice');
      const sortSelect = main.called('addSelect').find(([, args]) => args[1] === 'sort_value');
      expect(sortSelect?.[1][0]).toContain('MIN(s.monthly_price)');
      expect(sortSelect?.[1][0]).toContain('s.monthly_price >= :minPrice');
      expect(main.called('orderBy')[0][1]).toEqual(['sort_value', 'ASC', 'NULLS LAST']);
      expect(
        summary
          .called('addSelect')
          .some(([, a]) => String(a[0]).includes('s.monthly_price >= :minPrice')),
      ).toBe(true);
    });

    it('sorts a shelf warehouse by its dearest shelf when sorting by price descending', async () => {
      const main = fakeQb({ many: [parentUnit], count: 1 });
      const { service } = build({ main });

      await service.listPublic({ sort: 'price_desc' });

      const sortSelect = main.called('addSelect').find(([, args]) => args[1] === 'sort_value');
      expect(sortSelect?.[1][0]).toContain('MAX(s.monthly_price)');
      expect(main.called('orderBy')[0][1]).toEqual(['sort_value', 'DESC', 'NULLS LAST']);
    });

    it('paginates with offset/limit and a separate count, never skip/take', async () => {
      const main = fakeQb({ many: [], count: 45 });
      const { service } = build({ main });

      const { meta } = await service.listPublic({ page: 3, limit: 10 });

      expect(main.called('offset')[0][1]).toEqual([20]);
      expect(main.called('limit')[0][1]).toEqual([10]);
      expect(main.called('skip')).toHaveLength(0);
      expect(main.called('take')).toHaveLength(0);
      expect(meta.total).toBe(45);
    });
  });

  describe('listAdmin', () => {
    it('matches a building through the code of one of its shelves', async () => {
      const main = fakeQb({ many: [], count: 0 });
      await build({ main }).service.listAdmin({ search: 'KK1-A-03' });

      expect(main.where()).toContain(
        's.parent_id = unit.id AND s.deleted_at IS NULL AND (s.code ILIKE :search',
      );
    });

    it('a RENTED filter matches a building that has a rented shelf', async () => {
      const main = fakeQb({ many: [], count: 0 });
      await build({ main }).service.listAdmin({ status: StorageUnitStatus.RENTED });

      const sql = main.where();
      expect(sql).toContain('s.status = :status');
      expect(sql).not.toContain("s.status = 'AVAILABLE'");
      expect(main.called('andWhere').at(-1)?.[1][1]).toMatchObject({ status: 'RENTED' });
    });

    it('an AVAILABLE filter needs an open building as well as a free shelf', async () => {
      const main = fakeQb({ many: [], count: 0 });
      await build({ main }).service.listAdmin({ status: StorageUnitStatus.AVAILABLE });

      expect(main.where()).toContain(
        '(unit.kind = :parentKind AND unit.status = :status AND EXISTS (SELECT 1 FROM storage_units s',
      );
    });

    it('keeps every building when no filter narrows the shelves', async () => {
      const main = fakeQb({ many: [], count: 0 });
      await build({ main }).service.listAdmin({});

      expect(main.where()).toContain('(unit.kind = :parentKind)');
    });
  });

  it('listAssigned leaves shelves out', async () => {
    const main = fakeQb({ many: [] });
    const { service } = build({
      main,
      assignments: [{ facilityId: 'fac-1', startsAt: new Date(0), endsAt: null }],
    });

    await service.listAssigned('user-1');

    expect(main.called('andWhere')[0]).toEqual([
      'andWhere',
      ['unit.kind <> :shelfKind', { shelfKind: 'SHELF' }],
    ]);
  });

  it.each([
    ['catalogue', (service: WarehouseQueryService) => service.listPublic({ page: 1, limit: 20 })],
    ['nearby search', (service: WarehouseQueryService) => service.listAvailable()],
  ])('hides shelf warehouses from the %s unless the client opts in', async (_label, list) => {
    const main = fakeQb({ many: [], count: 0 });
    await list(build({ main }).service);

    expect(main.called('andWhere')).toContainEqual([
      'andWhere',
      ['unit.kind <> :hiddenKind', { hiddenKind: StorageUnitKind.SHELF_WAREHOUSE }],
    ]);

    const optedIn = fakeQb({ many: [], count: 0 });
    await build({ main: optedIn }).service.listAvailable(true);
    expect(optedIn.where()).not.toContain('unit.kind <> :hiddenKind');
  });

  describe('listShelves', () => {
    const parent = {
      id: 'parent-1',
      kind: StorageUnitKind.SHELF_WAREHOUSE,
      status: StorageUnitStatus.AVAILABLE,
      facilityId: 'fac-1',
      facility: { status: FacilityStatus.ACTIVE },
    };

    it('is 404 for a unit that is not a shelf warehouse', async () => {
      const { service } = build({
        main: fakeQb({}),
        parent: { ...parent, kind: StorageUnitKind.SELF_STORAGE },
      });
      await expect(
        service.listShelves('parent-1', { includeInactive: false }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('hides retired shelves from customers but not from back office', async () => {
      const publicQb = fakeQb({ many: [] });
      await build({ main: publicQb, parent }).service.listShelves('parent-1', {
        includeInactive: false,
      });
      expect(publicQb.where()).toContain('unit.status <> :inactive');

      const adminQb = fakeQb({ many: [] });
      await build({ main: adminQb, parent }).service.listShelves('parent-1', {
        includeInactive: true,
        actor: { id: 'ops', roles: [UserRole.OPERATIONS_MANAGER] } as never,
      });
      expect(adminQb.where()).not.toContain('unit.status <> :inactive');
    });

    it.each([
      ['a warehouse under maintenance', { status: StorageUnitStatus.MAINTENANCE }],
      ['a retired warehouse', { status: StorageUnitStatus.INACTIVE }],
      ['a warehouse in a closed facility', { facility: { status: FacilityStatus.INACTIVE } }],
    ])('is 404 to customers for %s but visible to back office', async (_label, extra) => {
      const closed = { ...parent, ...extra };
      await expect(
        build({ main: fakeQb({ many: [] }), parent: closed }).service.listShelves('parent-1', {
          includeInactive: false,
        }),
      ).rejects.toMatchObject({ status: 404 });

      await expect(
        build({ main: fakeQb({ many: [] }), parent: closed }).service.listShelves('parent-1', {
          includeInactive: true,
          actor: { id: 'ops', roles: [UserRole.OPERATIONS_MANAGER] } as never,
        }),
      ).resolves.toEqual([]);
    });

    it('only counts facility manager assignments, not staff ones', async () => {
      const { service, roleAssignments } = build({ main: fakeQb({}), parent });
      await expect(
        service.listShelves('parent-1', {
          includeInactive: true,
          actor: { id: 'fm', roles: [UserRole.FACILITY_MANAGER] } as never,
        }),
      ).rejects.toMatchObject({ status: 403 });
      expect(roleAssignments.find).toHaveBeenCalledWith({
        where: { userId: 'fm', role: In([UserRole.FACILITY_MANAGER]) },
      });
    });

    it('forbids a facility manager of another facility', async () => {
      const { service } = build({
        main: fakeQb({}),
        parent,
        assignments: [{ facilityId: 'fac-2', startsAt: new Date(0), endsAt: null }],
      });
      await expect(
        service.listShelves('parent-1', {
          includeInactive: true,
          actor: { id: 'fm', roles: [UserRole.FACILITY_MANAGER] } as never,
        }),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('lets the facility manager of the owning facility in', async () => {
      const { service } = build({
        main: fakeQb({ many: [] }),
        parent,
        assignments: [{ facilityId: 'fac-1', startsAt: new Date(0), endsAt: null }],
      });
      await expect(
        service.listShelves('parent-1', {
          includeInactive: true,
          actor: { id: 'fm', roles: [UserRole.FACILITY_MANAGER] } as never,
        }),
      ).resolves.toEqual([]);
    });
  });
});
