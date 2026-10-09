import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { DomainException } from '@shared/exceptions/domain.exception';
import { StorageUnitStatus, UserRole } from '@storage/types';
import { WarehouseCommandService } from './warehouse-command.service';

const buildFacility = (overrides: Partial<Facility> = {}): Facility =>
  ({ id: 'wh-1', code: 'HCM-01', wardCode: '26740', provinceCode: '79', ...overrides }) as Facility;

const buildUnit = (overrides: Partial<StorageUnit> = {}): StorageUnit =>
  ({
    id: 'unit-1',
    facilityId: 'wh-1',
    code: 'HCM-01',
    widthM: '5.00' as unknown as number,
    lengthM: '8.00' as unknown as number,
    heightM: '3.50' as unknown as number,
    status: StorageUnitStatus.AVAILABLE,
    ...overrides,
  }) as StorageUnit;

const createDto = {
  code: 'HCM-02',
  name: 'Kho mới',
  addressLine: '1 Test',
  latitude: 10.7,
  longitude: 106.7,
  widthM: 4,
  lengthM: 5,
  heightM: 3,
  monthlyPrice: 4_000_000,
};

describe('WarehouseCommandService', () => {
  let manager: {
    findOne: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
  };
  let query: jest.Mock;
  let roleAssignments: { find: jest.Mock };
  let queries: { findOne: jest.Mock };
  let service: WarehouseCommandService;

  const stubWarehouse = (facility: Facility | null, unit: StorageUnit | null) =>
    manager.findOne.mockImplementation(async (entity: unknown) =>
      entity === Facility ? facility : unit,
    );

  beforeEach(() => {
    manager = {
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((_entity, data) => data),
      save: jest.fn(async (data) => ({ id: 'wh-new', ...data })),
      update: jest.fn().mockResolvedValue(undefined),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };
    stubWarehouse(buildFacility(), buildUnit());
    query = jest.fn().mockResolvedValue([{ province_code: '79' }]);
    const facilities = {
      manager: { transaction: jest.fn((work) => work(manager)), query },
    };
    roleAssignments = { find: jest.fn().mockResolvedValue([]) };
    queries = { findOne: jest.fn().mockResolvedValue({ id: 'wh-1' }) };
    service = new WarehouseCommandService(
      facilities as never,
      roleAssignments as never,
      queries as never,
    );
  });

  describe('create', () => {
    it('writes the facility and its single unit, deriving the province from the ward', async () => {
      await service.create({ ...createDto, wardCode: '26740' });

      expect(manager.create).toHaveBeenCalledWith(
        Facility,
        expect.objectContaining({ code: 'HCM-02', wardCode: '26740', provinceCode: '79' }),
      );
      expect(manager.create).toHaveBeenCalledWith(
        StorageUnit,
        expect.objectContaining({
          facilityId: 'wh-new',
          code: 'HCM-02',
          monthlyPrice: 4_000_000,
          depositMonths: null,
          status: StorageUnitStatus.AVAILABLE,
        }),
      );
    });

    it('rejects a ward outside the given province', async () => {
      await expect(
        service.create({ ...createDto, wardCode: '26740', provinceCode: '01' }),
      ).rejects.toMatchObject({ status: 400 });
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('rejects an unknown ward', async () => {
      query.mockResolvedValue([]);

      await expect(service.create({ ...createDto, wardCode: 'nope' })).rejects.toMatchObject({
        status: 400,
      });
    });
  });

  describe('update', () => {
    it.each([
      [{ status: StorageUnitStatus.MAINTENANCE }, 'status'],
      [{ widthM: 6 }, 'widthM'],
      [{ heightM: 4 }, 'heightM'],
      [{ code: 'HCM-99' }, 'code'],
    ])('rejects %o on a RENTED warehouse', async (dto, field) => {
      stubWarehouse(buildFacility(), buildUnit({ status: StorageUnitStatus.RENTED }));

      const error = await service.update('wh-1', dto).catch((err: unknown) => err);

      expect(error).toBeInstanceOf(DomainException);
      expect((error as DomainException).getStatus()).toBe(409);
      expect((error as DomainException).message).toContain(field);
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('lets price, deposit, notes and unchanged size through on a RENTED warehouse', async () => {
      stubWarehouse(buildFacility(), buildUnit({ status: StorageUnitStatus.RENTED }));

      await service.update('wh-1', {
        monthlyPrice: 7_000_000,
        depositMonths: 3,
        notes: 'Đổi khoá',
        widthM: 5,
        code: 'HCM-01',
      });

      expect(manager.update).toHaveBeenCalledWith(StorageUnit, 'unit-1', {
        monthlyPrice: 7_000_000,
        depositMonths: 3,
        notes: 'Đổi khoá',
        widthM: 5,
        code: 'HCM-01',
      });
    });

    it('checks a province-only change against the stored ward', async () => {
      await expect(service.update('wh-1', { provinceCode: '01' })).rejects.toMatchObject({
        status: 400,
      });
    });

    it('rejects null for a required field but lets the deposit return to the default', async () => {
      await expect(service.update('wh-1', { name: null } as never)).rejects.toMatchObject({
        status: 400,
      });

      await service.update('wh-1', { depositMonths: null });

      expect(manager.update).toHaveBeenCalledWith(StorageUnit, 'unit-1', { depositMonths: null });
    });

    it('returns 404 for a deleted or unknown warehouse', async () => {
      stubWarehouse(null, null);

      await expect(service.update('wh-x', { notes: 'x' })).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('updateStatus', () => {
    const manager1 = { id: 'mgr-1', roles: [UserRole.FACILITY_MANAGER] } as never;

    it('forbids a manager who does not manage the warehouse', async () => {
      await expect(
        service.updateStatus('wh-1', { status: StorageUnitStatus.MAINTENANCE }, manager1),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('refuses to toggle a held warehouse', async () => {
      roleAssignments.find.mockResolvedValue([{ startsAt: new Date(0), endsAt: null }]);
      stubWarehouse(buildFacility(), buildUnit({ status: StorageUnitStatus.HELD }));

      await expect(
        service.updateStatus('wh-1', { status: StorageUnitStatus.MAINTENANCE }, manager1),
      ).rejects.toMatchObject({ status: 409 });
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('lets operations take an available warehouse out of service', async () => {
      await service.updateStatus('wh-1', { status: StorageUnitStatus.MAINTENANCE }, {
        id: 'ops',
        roles: [UserRole.OPERATIONS_MANAGER],
      } as never);

      expect(manager.update).toHaveBeenCalledWith(StorageUnit, 'unit-1', {
        status: StorageUnitStatus.MAINTENANCE,
      });
    });
  });

  describe('softDelete', () => {
    it.each([
      StorageUnitStatus.HELD,
      StorageUnitStatus.BOOKED,
      StorageUnitStatus.RENTED,
      StorageUnitStatus.PENDING_INSPECTION,
    ])('refuses a %s warehouse', async (status) => {
      stubWarehouse(buildFacility(), buildUnit({ status }));

      await expect(service.softDelete('wh-1')).rejects.toMatchObject({ status: 409 });
      expect(manager.softDelete).not.toHaveBeenCalled();
    });

    it('refuses while a tour appointment is open', async () => {
      manager.count.mockResolvedValue(1);

      await expect(service.softDelete('wh-1')).rejects.toMatchObject({ status: 409 });
    });

    it('retires the facility together with its unit', async () => {
      await service.softDelete('wh-1');

      expect(manager.softDelete).toHaveBeenCalledWith(StorageUnit, 'unit-1');
      expect(manager.softDelete).toHaveBeenCalledWith(Facility, 'wh-1');
    });
  });
});
