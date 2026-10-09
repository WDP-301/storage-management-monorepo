import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { TourAppointment } from '@entities/tour-appointment.entity';
import { DomainException } from '@shared/exceptions/domain.exception';
import { StorageUnitStatus, UserRole } from '@storage/types';
import { WarehouseCommandService } from './warehouse-command.service';

const buildFacility = (overrides: Partial<Facility> = {}): Facility =>
  ({ id: 'fac-1', code: 'CN-HCM', name: 'Cơ sở HCM', ...overrides }) as Facility;

const buildUnit = (overrides: Partial<StorageUnit> = {}): StorageUnit =>
  ({
    id: 'unit-1',
    facilityId: 'fac-1',
    code: 'HCM-01',
    wardCode: '26740',
    provinceCode: '79',
    widthM: '5.00' as unknown as number,
    lengthM: '8.00' as unknown as number,
    heightM: '3.50' as unknown as number,
    status: StorageUnitStatus.AVAILABLE,
    ...overrides,
  }) as StorageUnit;

const createDto = {
  facilityId: 'fac-1',
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
    query: jest.Mock;
    findOne: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
  };
  let query: jest.Mock;
  const lockCalls: string[] = [];
  let roleAssignments: { find: jest.Mock };
  let queries: { findOne: jest.Mock };
  let service: WarehouseCommandService;

  const stubWarehouse = (facility: Facility | null, unit: StorageUnit | null) =>
    manager.findOne.mockImplementation(async (entity: unknown) => {
      lockCalls.push(entity === Facility ? 'facility' : 'unit');
      return entity === Facility ? facility : unit;
    });

  beforeEach(() => {
    lockCalls.length = 0;
    query = jest.fn().mockResolvedValue([{ province_code: '79' }]);
    manager = {
      query,
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((_entity, data) => data),
      save: jest.fn(async (data) => ({ id: 'wh-new', ...data })),
      update: jest.fn().mockResolvedValue(undefined),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };
    stubWarehouse(buildFacility(), buildUnit());
    const units = { manager: { transaction: jest.fn((work) => work(manager)) } };
    roleAssignments = { find: jest.fn().mockResolvedValue([]) };
    queries = { findOne: jest.fn().mockResolvedValue({ id: 'unit-1' }) };
    service = new WarehouseCommandService(
      units as never,
      roleAssignments as never,
      queries as never,
    );
  });

  describe('create', () => {
    it('writes one unit under the facility, deriving the province from the ward', async () => {
      await service.create({ ...createDto, wardCode: '26740' });

      expect(manager.create).toHaveBeenCalledWith(
        StorageUnit,
        expect.objectContaining({
          facilityId: 'fac-1',
          code: 'HCM-02',
          wardCode: '26740',
          provinceCode: '79',
          monthlyPrice: 4_000_000,
          depositMonths: null,
          status: StorageUnitStatus.AVAILABLE,
        }),
      );
      expect(manager.create).not.toHaveBeenCalledWith(Facility, expect.anything());
    });

    it('rejects a missing or deleted facility', async () => {
      stubWarehouse(null, null);

      await expect(service.create(createDto)).rejects.toMatchObject({
        status: 400,
        message: 'Facility does not exist',
      });
      expect(manager.save).not.toHaveBeenCalled();
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
      [{ facilityId: 'fac-2' }, 'facilityId'],
    ])('rejects %o on a RENTED warehouse', async (dto, field) => {
      stubWarehouse(buildFacility(), buildUnit({ status: StorageUnitStatus.RENTED }));

      const error = await service.update('unit-1', dto).catch((err: unknown) => err);

      expect(error).toBeInstanceOf(DomainException);
      expect((error as DomainException).getStatus()).toBe(409);
      expect((error as DomainException).message).toContain(field);
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('lets price, deposit, notes and unchanged size through on a RENTED warehouse', async () => {
      stubWarehouse(buildFacility(), buildUnit({ status: StorageUnitStatus.RENTED }));

      await service.update('unit-1', {
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

    it('moves an idle warehouse, locking the target facility before the unit', async () => {
      stubWarehouse(buildFacility({ id: 'fac-2' }), buildUnit());

      await service.update('unit-1', { facilityId: 'fac-2' });

      expect(lockCalls.slice(0, 2)).toEqual(['facility', 'unit']);
      expect(manager.update).toHaveBeenCalledWith(StorageUnit, 'unit-1', { facilityId: 'fac-2' });
    });

    it('refuses to move a warehouse that still has open tours', async () => {
      manager.count.mockResolvedValue(2);

      await expect(service.update('unit-1', { facilityId: 'fac-2' })).rejects.toMatchObject({
        status: 409,
      });
      expect(manager.count).toHaveBeenCalledWith(
        TourAppointment,
        expect.objectContaining({ where: expect.objectContaining({ storageUnitId: 'unit-1' }) }),
      );
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('does not count tours when the facility is unchanged', async () => {
      await service.update('unit-1', { facilityId: 'fac-1', notes: 'x' });

      expect(manager.count).not.toHaveBeenCalled();
    });

    it('rejects a move to a missing facility', async () => {
      manager.findOne.mockImplementation(async (entity: unknown) =>
        entity === Facility ? null : buildUnit(),
      );

      await expect(service.update('unit-1', { facilityId: 'fac-x' })).rejects.toMatchObject({
        status: 400,
      });
    });

    it('checks a province-only change against the stored ward', async () => {
      await expect(service.update('unit-1', { provinceCode: '01' })).rejects.toMatchObject({
        status: 400,
      });
    });

    it('rejects null for a required field but lets the deposit return to the default', async () => {
      await expect(service.update('unit-1', { name: null } as never)).rejects.toMatchObject({
        status: 400,
      });

      await service.update('unit-1', { depositMonths: null });

      expect(manager.update).toHaveBeenCalledWith(StorageUnit, 'unit-1', { depositMonths: null });
    });

    it('returns 404 for a deleted or unknown warehouse', async () => {
      stubWarehouse(null, null);

      await expect(service.update('unit-x', { notes: 'x' })).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('updateStatus', () => {
    const manager1 = { id: 'mgr-1', roles: [UserRole.FACILITY_MANAGER] } as never;

    it('forbids a manager who does not manage the warehouse', async () => {
      await expect(
        service.updateStatus('unit-1', { status: StorageUnitStatus.MAINTENANCE }, manager1),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('refuses to toggle a held warehouse', async () => {
      roleAssignments.find.mockResolvedValue([{ startsAt: new Date(0), endsAt: null }]);
      stubWarehouse(buildFacility(), buildUnit({ status: StorageUnitStatus.HELD }));

      await expect(
        service.updateStatus('unit-1', { status: StorageUnitStatus.MAINTENANCE }, manager1),
      ).rejects.toMatchObject({ status: 409 });
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('forbids a manager of another facility, using the facility read under lock', async () => {
      roleAssignments.find.mockResolvedValue([]);

      await service
        .updateStatus('unit-1', { status: StorageUnitStatus.MAINTENANCE }, manager1)
        .catch(() => undefined);

      expect(roleAssignments.find).toHaveBeenCalledWith({
        where: { userId: 'mgr-1', facilityId: 'fac-1', role: UserRole.FACILITY_MANAGER },
      });
    });

    it('lets operations take an available warehouse out of service', async () => {
      await service.updateStatus('unit-1', { status: StorageUnitStatus.MAINTENANCE }, {
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

      await expect(service.softDelete('unit-1')).rejects.toMatchObject({ status: 409 });
      expect(manager.softDelete).not.toHaveBeenCalled();
    });

    it('refuses while a tour appointment is open', async () => {
      manager.count.mockResolvedValue(1);

      await expect(service.softDelete('unit-1')).rejects.toMatchObject({ status: 409 });
    });

    it('retires only the unit and counts tours on this warehouse', async () => {
      await service.softDelete('unit-1');

      expect(manager.softDelete).toHaveBeenCalledTimes(1);
      expect(manager.softDelete).toHaveBeenCalledWith(StorageUnit, 'unit-1');
      expect(manager.count).toHaveBeenCalledWith(
        TourAppointment,
        expect.objectContaining({ where: expect.objectContaining({ storageUnitId: 'unit-1' }) }),
      );
    });
  });
});
