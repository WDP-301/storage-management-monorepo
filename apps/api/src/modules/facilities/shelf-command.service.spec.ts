import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { FacilityStatus, StorageUnitKind } from '@storage/types';
import { ShelfCommandService } from './shelf-command.service';

const facility = { id: 'fac-1', status: FacilityStatus.ACTIVE } as Facility;
const parent = {
  id: 'p1',
  facilityId: 'fac-1',
  kind: StorageUnitKind.SHELF_WAREHOUSE,
  code: 'KK1',
  name: 'Kho kệ 1',
  addressLine: '12 Test',
  wardCode: '26740',
  provinceCode: '79',
  latitude: '10.700000',
  longitude: '106.700000',
} as unknown as StorageUnit;

const spec = { widthM: 1, lengthM: 0.6, monthlyPrice: 300_000 };

describe('ShelfCommandService', () => {
  let manager: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let calls: string[];
  let queries: { findOne: jest.Mock };
  let service: ShelfCommandService;

  const stub = (
    overrides: {
      facility?: Facility | null;
      parent?: StorageUnit | null;
      locked?: StorageUnit | null;
    } = {},
  ) => {
    const row = 'parent' in overrides ? overrides.parent : parent;
    manager.findOne.mockImplementation(
      async (entity: unknown, options: { lock?: { mode: string } }) => {
        if (entity === Facility) {
          calls.push('facility');
          return 'facility' in overrides ? overrides.facility : facility;
        }
        calls.push(options.lock ? `parent:${options.lock.mode}` : 'parent');
        return options.lock && 'locked' in overrides ? overrides.locked : row;
      },
    );
  };

  beforeEach(() => {
    calls = [];
    manager = {
      findOne: jest.fn(),
      create: jest.fn((_entity, data) => data),
      save: jest.fn(async (rows: StorageUnit[]) =>
        rows.map((row, i) => ({ id: `s${i + 1}`, ...row })),
      ),
    };
    stub();
    queries = { findOne: jest.fn().mockResolvedValue({ id: 's1' }) };
    service = new ShelfCommandService(
      { manager: { transaction: jest.fn((work) => work(manager)) } } as never,
      queries as never,
    );
  });

  describe('createShelf', () => {
    it('copies facility and location from the parent read under a shared lock', async () => {
      const locked = { ...parent, addressLine: 'Mới nhất' } as StorageUnit;
      stub({ locked });

      await service.createShelf('p1', { code: 'KK1-A-03', ...spec, heightM: 2 });

      expect(calls).toEqual(['parent', 'facility', 'parent:pessimistic_read']);
      expect(manager.create).toHaveBeenCalledWith(
        StorageUnit,
        expect.objectContaining({
          kind: StorageUnitKind.SHELF,
          parentId: 'p1',
          facilityId: 'fac-1',
          addressLine: 'Mới nhất',
          wardCode: '26740',
          provinceCode: '79',
          latitude: '10.700000',
          longitude: '106.700000',
          code: 'KK1-A-03',
          name: 'Kho kệ 1 · Kệ A-03',
          heightM: 2,
          monthlyPrice: 300_000,
          depositMonths: null,
          status: 'AVAILABLE',
        }),
      );
      expect(queries.findOne).toHaveBeenCalledWith('s1');
    });

    it('keeps an explicit name and an idle status', async () => {
      await service.createShelf('p1', {
        code: 'X-1',
        name: 'Kệ đặc biệt',
        status: 'MAINTENANCE',
        ...spec,
      });

      expect(manager.create).toHaveBeenCalledWith(
        StorageUnit,
        expect.objectContaining({ name: 'Kệ đặc biệt', status: 'MAINTENANCE' }),
      );
    });

    it('is 404 for a missing or deleted parent', async () => {
      stub({ parent: null });
      await expect(service.createShelf('p1', { code: 'A', ...spec })).rejects.toMatchObject({
        status: 404,
      });
    });

    it('is 400 when the parent is not a shelf warehouse', async () => {
      stub({ parent: { ...parent, kind: StorageUnitKind.SELF_STORAGE } as StorageUnit });
      await expect(service.createShelf('p1', { code: 'A', ...spec })).rejects.toMatchObject({
        status: 400,
      });
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('is 409 when the facility is inactive', async () => {
      stub({ facility: { ...facility, status: FacilityStatus.INACTIVE } as Facility });
      await expect(service.createShelf('p1', { code: 'A', ...spec })).rejects.toMatchObject({
        status: 409,
      });
    });

    it('is 409 when the parent moved facility between the two reads', async () => {
      stub({ locked: { ...parent, facilityId: 'fac-2' } as StorageUnit });
      await expect(service.createShelf('p1', { code: 'A', ...spec })).rejects.toMatchObject({
        status: 409,
      });
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('turns a duplicate code into 409', async () => {
      manager.save.mockRejectedValue({ driverError: { code: '23505' }, code: '23505' });
      await expect(service.createShelf('p1', { code: 'A', ...spec })).rejects.toMatchObject({
        status: 409,
      });
    });
  });

  describe('bulkCreate', () => {
    it('generates padded codes in one save', async () => {
      const result = await service.bulkCreate('p1', { prefix: 'A', from: 1, to: 3, ...spec });

      expect(result).toEqual({ created: 3, codes: ['KK1-A-01', 'KK1-A-02', 'KK1-A-03'] });
      expect(manager.save).toHaveBeenCalledTimes(1);
      expect(manager.create).toHaveBeenCalledWith(
        StorageUnit,
        expect.objectContaining({ name: 'Kho kệ 1 · Kệ A-01' }),
      );
    });

    it('honours pad 0 and a wider pad', async () => {
      expect(
        (await service.bulkCreate('p1', { prefix: 'B', from: 9, to: 10, pad: 0, ...spec })).codes,
      ).toEqual(['KK1-B-9', 'KK1-B-10']);
      expect(
        (await service.bulkCreate('p1', { prefix: 'B', from: 1, to: 1, pad: 4, ...spec })).codes,
      ).toEqual(['KK1-B-0001']);
    });

    it('rejects more than 200 shelves, an inverted range and an over-long code before inserting', async () => {
      await expect(
        service.bulkCreate('p1', { prefix: 'A', from: 1, to: 201, ...spec }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        service.bulkCreate('p1', { prefix: 'A', from: 5, to: 4, ...spec }),
      ).rejects.toMatchObject({ status: 400 });
      stub({ parent: { ...parent, code: 'K'.repeat(48) } as StorageUnit });
      await expect(
        service.bulkCreate('p1', { prefix: 'A', from: 1, to: 1, ...spec }),
      ).rejects.toMatchObject({ status: 400 });
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('accepts exactly 200', async () => {
      await expect(
        service.bulkCreate('p1', { prefix: 'A', from: 1, to: 200, ...spec }),
      ).resolves.toMatchObject({ created: 200 });
    });

    it('is all-or-nothing on a clashing code: 409 and no result', async () => {
      manager.save.mockRejectedValue({ code: '23505' });
      await expect(
        service.bulkCreate('p1', { prefix: 'A', from: 1, to: 3, ...spec }),
      ).rejects.toMatchObject({ status: 409 });
    });
  });
});
