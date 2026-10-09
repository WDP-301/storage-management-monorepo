import { AppUser } from '@entities/app-user.entity';
import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { TourAppointment } from '@entities/tour-appointment.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { FacilityStatus, TourAppointmentStatus, UserRole, UserStatus } from '@storage/types';
import type { Repository } from 'typeorm';
import { TourAppointmentsService } from './tour-appointments.service';

const buildActor = (overrides: Partial<AuthUser> = {}): AuthUser =>
  ({
    id: 'user-manager-1',
    email: 'manager@example.com',
    phone: '0901111111',
    fullName: 'Manager User',
    status: UserStatus.ACTIVE,
    roles: [UserRole.FACILITY_MANAGER],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }) as AuthUser;

const buildAppointment = (overrides: Partial<TourAppointment> = {}): TourAppointment =>
  ({
    id: 'apt-1',
    facilityId: 'facility-1',
    customerId: null,
    fullName: 'Khách Hàng A',
    phone: '0987654321',
    email: 'khach@example.com',
    storageUnitId: null,
    preferredDate: '2026-10-15',
    preferredTimeSlot: '09:00 - 11:00',
    customerNotes: 'Cần thuê kho 10m2',
    status: TourAppointmentStatus.PENDING,
    assignedTo: null,
    managerNotes: null,
    staffResultNotes: null,
    cancellationReason: null,
    createdAt: new Date('2026-10-08T00:00:00Z'),
    updatedAt: new Date('2026-10-08T00:00:00Z'),
    facility: {
      id: 'facility-1',
      code: 'F01',
      name: 'Kho Thủ Đức',
      addressLine: '123 Song Hành',
    } as Facility,
    customer: null,
    storageUnit: null,
    assignee: null,
    ...overrides,
  }) as TourAppointment;

const buildManagerAssignment = (userId: string, facilityId: string): UserRoleAssignment =>
  ({
    id: 'assignment-mgr-1',
    userId,
    role: UserRole.FACILITY_MANAGER,
    facilityId,
    startsAt: new Date('2026-01-01T00:00:00Z'),
    endsAt: null,
  }) as UserRoleAssignment;

const buildStaffAssignment = (userId: string, facilityId: string): UserRoleAssignment =>
  ({
    id: 'assignment-staff-1',
    userId,
    role: UserRole.FACILITY_STAFF,
    facilityId,
    startsAt: new Date('2026-01-01T00:00:00Z'),
    endsAt: null,
  }) as UserRoleAssignment;

describe('TourAppointmentsService', () => {
  let service: TourAppointmentsService;
  let appointmentsRepo: jest.Mocked<Repository<TourAppointment>>;
  let facilitiesRepo: jest.Mocked<Repository<Facility>>;
  let storageUnitsRepo: jest.Mocked<Repository<StorageUnit>>;
  let usersRepo: jest.Mocked<Repository<AppUser>>;
  let roleAssignmentsRepo: jest.Mocked<Repository<UserRoleAssignment>>;

  beforeEach(() => {
    appointmentsRepo = {
      create: jest.fn((entity) => ({ ...entity, id: 'apt-created' })) as any,
      save: jest.fn((entity) =>
        Promise.resolve({ ...entity, id: entity.id ?? 'apt-created' }),
      ) as any,
      findOne: jest.fn() as any,
      createQueryBuilder: jest.fn() as any,
    } as any;
    // Transactional writes route back to the per-entity repo mocks so assertions stay on them.
    const repoFor = (entity: unknown): any =>
      entity === Facility
        ? facilitiesRepo
        : entity === StorageUnit
          ? storageUnitsRepo
          : appointmentsRepo;
    (appointmentsRepo as any).manager = {
      transaction: jest.fn((work: (manager: unknown) => unknown) =>
        work({
          findOne: (entity: unknown, options: unknown) => repoFor(entity).findOne(options),
          create: (_entity: unknown, data: unknown) => appointmentsRepo.create(data as any),
          save: (data: unknown) => appointmentsRepo.save(data as any),
        }),
      ),
    };

    facilitiesRepo = {
      findOne: jest.fn() as any,
    } as any;

    storageUnitsRepo = {
      findOne: jest.fn() as any,
    } as any;

    usersRepo = {
      findOne: jest.fn() as any,
    } as any;

    roleAssignmentsRepo = {
      find: jest.fn().mockResolvedValue([]) as any,
      findOne: jest.fn() as any,
    } as any;

    service = new TourAppointmentsService(appointmentsRepo, usersRepo, roleAssignmentsRepo);
  });

  describe('createContactRequest', () => {
    it('only accepts open facilities, locked against a concurrent delete', async () => {
      facilitiesRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createContactRequest({
          facilityId: 'facility-closed',
          fullName: 'Khách',
          phone: '0987654321',
          email: 'khach@example.com',
          preferredDate: '2026-12-01',
        } as never),
      ).rejects.toMatchObject({ status: 404 });
      expect(facilitiesRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'facility-closed', status: FacilityStatus.ACTIVE },
        lock: { mode: 'pessimistic_read' },
      });
      expect(appointmentsRepo.save).not.toHaveBeenCalled();
    });

    it('creates a new tour appointment in PENDING status for guest', async () => {
      facilitiesRepo.findOne.mockResolvedValue({ id: 'facility-1', name: 'Kho 1' } as Facility);
      appointmentsRepo.findOne.mockResolvedValue(buildAppointment({ id: 'apt-created' }));

      const res = await service.createContactRequest({
        facilityId: 'facility-1',
        fullName: 'Nguyễn Văn Khách',
        phone: '0987654321',
        email: 'khach@example.com',
        preferredDate: '2026-10-20',
        preferredTimeSlot: 'Chiều',
      });

      expect(facilitiesRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'facility-1', status: FacilityStatus.ACTIVE },
        lock: { mode: 'pessimistic_read' },
      });
      expect(appointmentsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          facilityId: 'facility-1',
          fullName: 'Nguyễn Văn Khách',
          status: TourAppointmentStatus.PENDING,
          customerId: null,
        }),
      );
      expect(res.appointment.status).toBe(TourAppointmentStatus.PENDING);
    });

    it('links customerId when actor is authenticated', async () => {
      facilitiesRepo.findOne.mockResolvedValue({ id: 'facility-1', name: 'Kho 1' } as Facility);
      appointmentsRepo.findOne.mockResolvedValue(
        buildAppointment({ id: 'apt-created', customerId: 'customer-123' }),
      );

      const res = await service.createContactRequest(
        {
          facilityId: 'facility-1',
          fullName: 'Nguyễn Văn Khách',
          phone: '0987654321',
          email: 'khach@example.com',
          preferredDate: '2026-10-20',
        },
        'customer-123',
      );

      expect(appointmentsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'customer-123',
        }),
      );
      expect(res.appointment.customerId).toBe('customer-123');
    });

    it('throws 404 if facility does not exist', async () => {
      facilitiesRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createContactRequest({
          facilityId: 'unknown-facility',
          fullName: 'Khách',
          phone: '0987654321',
          email: 'khach@example.com',
          preferredDate: '2026-10-20',
        }),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('confirmAppointment', () => {
    it('allows facility manager of the facility to confirm appointment', async () => {
      const manager = buildActor({ id: 'mgr-1', roles: [UserRole.FACILITY_MANAGER] });
      const apt = buildAppointment({
        id: 'apt-1',
        facilityId: 'facility-1',
        status: TourAppointmentStatus.PENDING,
      });
      appointmentsRepo.findOne.mockResolvedValue(apt);
      roleAssignmentsRepo.find.mockResolvedValue([buildManagerAssignment('mgr-1', 'facility-1')]);

      const res = await service.confirmAppointment(
        'apt-1',
        { managerNotes: 'Đã trao đổi, hẹn 10h' },
        manager,
      );

      expect(appointmentsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TourAppointmentStatus.CONFIRMED,
          managerNotes: 'Đã trao đổi, hẹn 10h',
        }),
      );
      expect(res.appointment.status).toBe(TourAppointmentStatus.CONFIRMED);
    });

    it('throws 403 if manager does not manage the facility', async () => {
      const manager = buildActor({ id: 'mgr-2', roles: [UserRole.FACILITY_MANAGER] });
      const apt = buildAppointment({ id: 'apt-1', facilityId: 'facility-1' });
      appointmentsRepo.findOne.mockResolvedValue(apt);
      // manager 2 only manages facility-99
      roleAssignmentsRepo.find.mockResolvedValue([buildManagerAssignment('mgr-2', 'facility-99')]);

      await expect(service.confirmAppointment('apt-1', {}, manager)).rejects.toThrow(
        DomainException,
      );
    });
  });

  describe('assignAppointment', () => {
    it('assigns active facility staff of that facility to appointment', async () => {
      const manager = buildActor({ id: 'mgr-1', roles: [UserRole.FACILITY_MANAGER] });
      const apt = buildAppointment({
        id: 'apt-1',
        facilityId: 'facility-1',
        status: TourAppointmentStatus.CONFIRMED,
      });
      appointmentsRepo.findOne.mockResolvedValue(apt);
      roleAssignmentsRepo.find
        .mockResolvedValueOnce([buildManagerAssignment('mgr-1', 'facility-1')]) // manager check
        .mockResolvedValueOnce([buildStaffAssignment('staff-1', 'facility-1')]); // staff check

      usersRepo.findOne.mockResolvedValue({
        id: 'staff-1',
        status: UserStatus.ACTIVE,
        fullName: 'Nhân viên 1',
      } as AppUser);

      const res = await service.assignAppointment('apt-1', { assignedTo: 'staff-1' }, manager);

      expect(appointmentsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedTo: 'staff-1',
          status: TourAppointmentStatus.ASSIGNED,
        }),
      );
      expect(res.appointment.status).toBe(TourAppointmentStatus.ASSIGNED);
    });

    it('reassigns from one staff to another, replacing the loaded assignee relation', async () => {
      const manager = buildActor({ id: 'mgr-1', roles: [UserRole.FACILITY_MANAGER] });
      const apt = buildAppointment({
        id: 'apt-1',
        facilityId: 'facility-1',
        status: TourAppointmentStatus.ASSIGNED,
        assignedTo: 'staff-1',
        assignee: { id: 'staff-1', fullName: 'Nhân viên 1' } as AppUser,
      });
      appointmentsRepo.findOne.mockResolvedValue(apt);
      roleAssignmentsRepo.find
        .mockResolvedValueOnce([buildManagerAssignment('mgr-1', 'facility-1')])
        .mockResolvedValueOnce([buildStaffAssignment('staff-2', 'facility-1')]);
      const newStaff = {
        id: 'staff-2',
        status: UserStatus.ACTIVE,
        fullName: 'Nhân viên 2',
      } as AppUser;
      usersRepo.findOne.mockResolvedValue(newStaff);

      await service.assignAppointment('apt-1', { assignedTo: 'staff-2' }, manager);

      expect(appointmentsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: 'staff-2', assignee: newStaff }),
      );
    });

    it('rejects assigning staff that does not belong to this facility', async () => {
      const manager = buildActor({ id: 'mgr-1', roles: [UserRole.FACILITY_MANAGER] });
      const apt = buildAppointment({
        id: 'apt-1',
        facilityId: 'facility-1',
        status: TourAppointmentStatus.CONFIRMED,
      });
      appointmentsRepo.findOne.mockResolvedValue(apt);
      roleAssignmentsRepo.find
        .mockResolvedValueOnce([buildManagerAssignment('mgr-1', 'facility-1')])
        .mockResolvedValueOnce([]); // no staff role at facility-1

      usersRepo.findOne.mockResolvedValue({
        id: 'staff-other',
        status: UserStatus.ACTIVE,
      } as AppUser);

      await expect(
        service.assignAppointment('apt-1', { assignedTo: 'staff-other' }, manager),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('completeAppointment', () => {
    it('allows assigned staff to complete appointment with consultation notes', async () => {
      const staff = buildActor({ id: 'staff-1', roles: [UserRole.FACILITY_STAFF] });
      const apt = buildAppointment({
        id: 'apt-1',
        facilityId: 'facility-1',
        assignedTo: 'staff-1',
        status: TourAppointmentStatus.ASSIGNED,
      });
      appointmentsRepo.findOne.mockResolvedValue(apt);

      const res = await service.completeAppointment(
        'apt-1',
        { staffResultNotes: 'Dẫn khách xem kho 10m2, khách sẽ thuê tuần tới' },
        staff,
      );

      expect(appointmentsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TourAppointmentStatus.COMPLETED,
          staffResultNotes: 'Dẫn khách xem kho 10m2, khách sẽ thuê tuần tới',
        }),
      );
      expect(res.appointment.status).toBe(TourAppointmentStatus.COMPLETED);
    });

    it('throws 403 if another staff tries to complete an appointment not assigned to them', async () => {
      const otherStaff = buildActor({ id: 'staff-99', roles: [UserRole.FACILITY_STAFF] });
      const apt = buildAppointment({
        id: 'apt-1',
        facilityId: 'facility-1',
        assignedTo: 'staff-1',
        status: TourAppointmentStatus.ASSIGNED,
      });
      appointmentsRepo.findOne.mockResolvedValue(apt);

      await expect(
        service.completeAppointment('apt-1', { staffResultNotes: 'Done' }, otherStaff),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('cancelAppointment', () => {
    it('allows assigned staff or manager to cancel when customer does not show up', async () => {
      const staff = buildActor({ id: 'staff-1', roles: [UserRole.FACILITY_STAFF] });
      const apt = buildAppointment({
        id: 'apt-1',
        facilityId: 'facility-1',
        assignedTo: 'staff-1',
        status: TourAppointmentStatus.ASSIGNED,
      });
      appointmentsRepo.findOne.mockResolvedValue(apt);

      const res = await service.cancelAppointment(
        'apt-1',
        { cancellationReason: 'Đã đợi 30 phút, gọi điện khách không nghe máy (No-show)' },
        staff,
      );

      expect(appointmentsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TourAppointmentStatus.CANCELLED,
          cancellationReason: 'Đã đợi 30 phút, gọi điện khách không nghe máy (No-show)',
        }),
      );
      expect(res.appointment.status).toBe(TourAppointmentStatus.CANCELLED);
    });

    it('cannot cancel an already completed appointment', async () => {
      const staff = buildActor({ id: 'staff-1', roles: [UserRole.FACILITY_STAFF] });
      const apt = buildAppointment({
        id: 'apt-1',
        facilityId: 'facility-1',
        assignedTo: 'staff-1',
        status: TourAppointmentStatus.COMPLETED,
      });
      appointmentsRepo.findOne.mockResolvedValue(apt);

      await expect(
        service.cancelAppointment('apt-1', { cancellationReason: 'Bận' }, staff),
      ).rejects.toThrow(DomainException);
    });
  });
});
