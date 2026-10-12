import { ShelfLayout } from '@entities/shelf-layout.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { TourAppointment } from '@entities/tour-appointment.entity';
import { StorageUnitKind, StorageUnitStatus } from '@storage/types';
import {
  assertParentClosable,
  assertParentMovable,
  assertParentPatchAllowed,
  assertShelfPatchAllowed,
  cascadeParentLocation,
  softDeleteWithShelves,
} from './shelf-parent-sync';

const parent = { id: 'p1', code: 'KK1', kind: StorageUnitKind.SHELF_WAREHOUSE } as StorageUnit;
const shelf = (
  id: string,
  status: StorageUnitStatus = StorageUnitStatus.AVAILABLE,
  deletedAt: Date | null = null,
) => ({ id, status, deletedAt }) as StorageUnit;

function buildManager(shelves: StorageUnit[], openTours = 0) {
  const order: string[] = [];
  const manager = {
    find: jest.fn(async () => {
      order.push('lockShelves');
      return shelves;
    }),
    count: jest.fn(async (entity: unknown, _options?: unknown) => {
      order.push(entity === TourAppointment ? 'countTours' : 'count');
      return entity === TourAppointment ? openTours : 0;
    }),
    update: jest.fn().mockResolvedValue(undefined),
    softDelete: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  return { manager: manager as never, mock: manager, order };
}

describe('assertShelfPatchAllowed', () => {
  it('rejects every location field and photos, naming each', () => {
    const attempt = () =>
      assertShelfPatchAllowed({ latitude: 1, addressLine: 'x', images: [], notes: 'ok' });

    expect(attempt).toThrow(expect.objectContaining({ status: 400 }));
    try {
      attempt();
    } catch (err) {
      const { details } = (
        err as { getResponse(): { details: { fields: { field: string }[] } } }
      ).getResponse();
      expect(details.fields.map((f) => f.field).sort()).toEqual([
        'addressLine',
        'images',
        'latitude',
      ]);
    }
  });

  it('lets price, deposit, dimensions, notes and status through', () => {
    expect(() =>
      assertShelfPatchAllowed({
        monthlyPrice: 1,
        depositMonths: 1,
        widthM: 1,
        notes: 'x',
        status: StorageUnitStatus.MAINTENANCE,
      }),
    ).not.toThrow();
  });
});

describe('assertParentPatchAllowed', () => {
  it.each([{ monthlyPrice: 5 }, { depositMonths: 2 }])(
    'rejects %o on a shelf warehouse',
    async (dto) => {
      await expect(
        assertParentPatchAllowed(buildManager([]).manager, dto, parent),
      ).rejects.toMatchObject({ status: 400 });
    },
  );

  it('freezes the code once shelves exist, but allows an unchanged code and a rename', async () => {
    const { manager, mock } = buildManager([]);
    mock.count.mockResolvedValue(3);

    await expect(assertParentPatchAllowed(manager, { code: 'KK2' }, parent)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      assertParentPatchAllowed(manager, { code: 'KK1', name: 'Mới' }, parent),
    ).resolves.toBeUndefined();
  });

  it('allows a code change while there are no shelves', async () => {
    await expect(
      assertParentPatchAllowed(buildManager([]).manager, { code: 'KK2' }, parent),
    ).resolves.toBeUndefined();
  });
});

describe('assertParentMovable', () => {
  it('locks the shelves before counting anything', async () => {
    const { manager, order } = buildManager([shelf('s1')]);

    await assertParentMovable(manager, parent);

    expect(order[0]).toBe('lockShelves');
    expect(order.slice(1)).toContain('countTours');
  });

  it('refuses while a shelf is rented, naming it', async () => {
    const { manager } = buildManager(
      [shelf('s1'), shelf('s2', StorageUnitStatus.RENTED), shelf('s3', StorageUnitStatus.HELD)],
      1,
    );

    await expect(assertParentMovable(manager, parent)).rejects.toMatchObject({
      status: 409,
      response: { details: { shelfIds: ['s2', 's3'], openTours: 1 } },
    });
  });

  it('counts tours over the building and its live shelves', async () => {
    const { manager, mock } = buildManager([
      shelf('s1'),
      shelf('gone', StorageUnitStatus.AVAILABLE, new Date()),
    ]);

    await assertParentMovable(manager, parent);

    const tourWhere = mock.count.mock.calls.find(([entity]) => entity === TourAppointment)?.[1] as {
      where: { storageUnitId: { value: string[] } };
    };
    expect(tourWhere.where.storageUnitId.value).toEqual(['p1', 's1']);
  });

  it('refuses while a tour is open on a shelf', async () => {
    const { manager } = buildManager([shelf('s1')], 2);

    await expect(assertParentMovable(manager, parent)).rejects.toMatchObject({ status: 409 });
  });
});

describe('assertParentClosable', () => {
  const open = { ...parent, status: StorageUnitStatus.AVAILABLE } as StorageUnit;

  it.each([StorageUnitStatus.MAINTENANCE, StorageUnitStatus.INACTIVE])(
    'refuses %s while a shelf is held, booked or rented, naming those shelves',
    async (next) => {
      const { manager } = buildManager([
        shelf('s1'),
        shelf('s2', StorageUnitStatus.HELD),
        shelf('s3', StorageUnitStatus.RENTED),
        shelf('s4', StorageUnitStatus.RENTED, new Date()),
      ]);

      await expect(assertParentClosable(manager, open, next)).rejects.toMatchObject({
        status: 409,
        response: { details: { shelfIds: ['s2', 's3'] } },
      });
    },
  );

  it('lets the building close once its shelves are idle', async () => {
    const { manager, mock } = buildManager([
      shelf('s1'),
      shelf('s2', StorageUnitStatus.MAINTENANCE),
    ]);

    await expect(
      assertParentClosable(manager, open, StorageUnitStatus.MAINTENANCE),
    ).resolves.toBeUndefined();
    expect(mock.find).toHaveBeenCalledWith(
      StorageUnit,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
  });

  it.each([
    ['no status change', StorageUnitStatus.AVAILABLE, undefined],
    ['reopening', StorageUnitStatus.MAINTENANCE, StorageUnitStatus.AVAILABLE],
    ['the status it already has', StorageUnitStatus.MAINTENANCE, StorageUnitStatus.MAINTENANCE],
  ])('takes no lock for %s', async (_label, current, next) => {
    const { manager, mock } = buildManager([shelf('s1', StorageUnitStatus.RENTED)]);

    await assertParentClosable(manager, { ...parent, status: current } as StorageUnit, next);

    expect(mock.find).not.toHaveBeenCalled();
  });
});

describe('cascadeParentLocation', () => {
  it('copies only location fields onto every shelf of the parent in one statement', async () => {
    const { manager, mock } = buildManager([]);

    await cascadeParentLocation(manager, 'p1', {
      addressLine: 'Mới',
      latitude: 10,
      facilityId: 'fac-2',
      name: 'ignored',
      monthlyPrice: 9,
    });

    expect(mock.update).toHaveBeenCalledTimes(1);
    expect(mock.update).toHaveBeenCalledWith(
      StorageUnit,
      { parentId: 'p1' },
      { addressLine: 'Mới', latitude: 10, facilityId: 'fac-2' },
    );
  });

  it('does nothing when no location field changed', async () => {
    const { manager, mock } = buildManager([]);

    await cascadeParentLocation(manager, 'p1', { name: 'Chỉ đổi tên' });

    expect(mock.update).not.toHaveBeenCalled();
  });
});

describe('softDeleteWithShelves', () => {
  it('retires the live shelves, the floor plan and the building after locking the shelves', async () => {
    const { manager, mock, order } = buildManager([
      shelf('s1'),
      shelf('s2', StorageUnitStatus.INACTIVE),
      shelf('old', StorageUnitStatus.AVAILABLE, new Date()),
    ]);

    await softDeleteWithShelves(manager, parent);

    expect(order[0]).toBe('lockShelves');
    expect(mock.softDelete).toHaveBeenNthCalledWith(1, StorageUnit, ['s1', 's2']);
    expect(mock.softDelete).toHaveBeenNthCalledWith(2, StorageUnit, 'p1');
    expect(mock.delete).toHaveBeenCalledWith(ShelfLayout, { warehouseId: 'p1' });
  });

  it('refuses with the blocking shelf ids when one is booked', async () => {
    const { manager, mock } = buildManager([shelf('s1'), shelf('s2', StorageUnitStatus.BOOKED)]);

    await expect(softDeleteWithShelves(manager, parent)).rejects.toMatchObject({
      status: 409,
      response: { details: { shelfIds: ['s2'], openTours: 0 } },
    });
    expect(mock.softDelete).not.toHaveBeenCalled();
    expect(mock.delete).not.toHaveBeenCalled();
  });

  it('refuses while a tour is open', async () => {
    const { manager, mock } = buildManager([shelf('s1')], 1);

    await expect(softDeleteWithShelves(manager, parent)).rejects.toMatchObject({ status: 409 });
    expect(mock.softDelete).not.toHaveBeenCalled();
  });

  it('retires an empty building without a shelf statement', async () => {
    const { manager, mock } = buildManager([]);

    await softDeleteWithShelves(manager, parent);

    expect(mock.softDelete).toHaveBeenCalledTimes(1);
  });
});
