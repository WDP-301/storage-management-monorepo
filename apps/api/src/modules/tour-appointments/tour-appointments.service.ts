import { AppUser } from '@entities/app-user.entity';
import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { TourAppointment } from '@entities/tour-appointment.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { activeFacilityIds, isAssignmentActive } from '@modules/auth/role-assignment.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { HttpStatus, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { buildPaginationMeta, ErrorCode } from '@shared/models/api-response';
import { isPastVietnamTimeSlot } from '@shared/utils/calendar.util';
import {
  FacilityStatus,
  NotificationType,
  StorageUnitStatus,
  TourAppointmentStatus,
  UserRole,
  UserStatus,
} from '@storage/types';
import { IsNull, Repository } from 'typeorm';
import type { AssignTourAppointmentDto } from './dto/assign-tour-appointment.dto';
import type { CancelTourAppointmentDto } from './dto/cancel-tour-appointment.dto';
import type { CompleteTourAppointmentDto } from './dto/complete-tour-appointment.dto';
import type { ConfirmTourAppointmentDto } from './dto/confirm-tour-appointment.dto';
import type { CreateContactTourDto } from './dto/create-contact-tour.dto';
import {
  DEFAULT_PAGE_SIZE,
  type ListTourAppointmentsQueryDto,
} from './dto/list-tour-appointments-query.dto';
import type {
  TourAppointmentListResponse,
  TourAppointmentRecord,
  TourAppointmentResponse,
} from './types/tour-appointment';

const APPOINTMENT_RELATIONS = ['facility', 'customer', 'storageUnit', 'assignee'];

/** Roles that can see and operate on appointments of every facility, not only ones they manage. */
const GLOBAL_APPOINTMENT_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER];

const isGlobalAppointmentActor = (actor: AuthUser): boolean =>
  actor.roles.some((r) => GLOBAL_APPOINTMENT_ROLES.includes(r));

export function toTourAppointmentRecord(apt: TourAppointment): TourAppointmentRecord {
  return {
    id: apt.id,
    facilityId: apt.facilityId,
    customerId: apt.customerId ?? null,
    fullName: apt.fullName,
    phone: apt.phone,
    email: apt.email,
    storageUnitId: apt.storageUnitId ?? null,
    preferredDate: apt.preferredDate,
    preferredTimeSlot: apt.preferredTimeSlot ?? null,
    customerNotes: apt.customerNotes ?? null,
    status: apt.status,
    assignedTo: apt.assignedTo ?? null,
    managerNotes: apt.managerNotes ?? null,
    staffResultNotes: apt.staffResultNotes ?? null,
    cancellationReason: apt.cancellationReason ?? null,
    createdAt: apt.createdAt,
    updatedAt: apt.updatedAt,
    facility: apt.facility
      ? {
          id: apt.facility.id,
          code: apt.facility.code,
          name: apt.facility.name,
        }
      : null,
    customer: apt.customer
      ? {
          id: apt.customer.id,
          fullName: apt.customer.fullName,
          email: apt.customer.email,
          phone: apt.customer.phone ?? null,
        }
      : null,
    storageUnit: apt.storageUnit
      ? {
          id: apt.storageUnit.id,
          code: apt.storageUnit.code,
          name: apt.storageUnit.name,
          addressLine: apt.storageUnit.addressLine,
        }
      : null,
    assignee: apt.assignee
      ? {
          id: apt.assignee.id,
          fullName: apt.assignee.fullName,
          email: apt.assignee.email,
          phone: apt.assignee.phone ?? null,
        }
      : null,
  };
}

@Injectable()
export class TourAppointmentsService {
  constructor(
    @InjectRepository(TourAppointment)
    private readonly appointments: Repository<TourAppointment>,
    @InjectRepository(UserRoleAssignment)
    private readonly roleAssignments: Repository<UserRoleAssignment>,
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  /**
   * Public contact form submission to schedule a facility/unit tour.
   * If customer is logged in, their customerId will be linked.
   */
  async createContactRequest(
    dto: CreateContactTourDto,
    customerId?: string | null,
  ): Promise<TourAppointmentResponse> {
    if (isPastVietnamTimeSlot(dto.preferredDate, dto.preferredTimeSlot)) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'preferredDate or preferredTimeSlot cannot be in the past',
        HttpStatus.BAD_REQUEST,
      );
    }

    const saved = await this.appointments.manager.transaction(async (manager) => {
      // FOR SHARE on an open facility: closed sites take no new tours.
      const facility = await manager.findOne(Facility, {
        where: { id: dto.facilityId, status: FacilityStatus.ACTIVE },
        lock: { mode: 'pessimistic_read' },
      });
      if (!facility) {
        notFound('Facility');
      }

      if (dto.storageUnitId) {
        const unit = await manager.findOne(StorageUnit, {
          where: { id: dto.storageUnitId, facilityId: dto.facilityId, deletedAt: IsNull() },
          // Serializes against a warehouse delete or move, which count open tours under the write lock.
          lock: { mode: 'pessimistic_read' },
        });
        if (!unit) {
          throw new DomainException(
            ErrorCode.RESOURCE_NOT_FOUND,
            'Storage unit does not exist in the requested facility',
            HttpStatus.NOT_FOUND,
          );
        }
        if (unit.status === StorageUnitStatus.RENTED) {
          throw new DomainException(
            ErrorCode.VALIDATION_FAILED,
            'Cannot schedule a tour for an occupied or rented storage unit',
            HttpStatus.BAD_REQUEST,
          );
        }
        if (
          unit.status === StorageUnitStatus.MAINTENANCE ||
          unit.status === StorageUnitStatus.INACTIVE ||
          unit.status === StorageUnitStatus.PENDING_INSPECTION
        ) {
          throw new DomainException(
            ErrorCode.VALIDATION_FAILED,
            'Cannot schedule a tour for a storage unit that is under maintenance or inactive',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      const created = await manager.save(
        manager.create(TourAppointment, {
          facilityId: dto.facilityId,
          customerId: customerId ?? null,
          fullName: dto.fullName.trim(),
          phone: dto.phone.trim(),
          email: dto.email.trim().toLowerCase(),
          storageUnitId: dto.storageUnitId ?? null,
          preferredDate: dto.preferredDate,
          preferredTimeSlot: dto.preferredTimeSlot?.trim() ?? null,
          customerNotes: dto.customerNotes?.trim() ?? null,
          status: TourAppointmentStatus.PENDING,
        }),
      );

      if (this.notificationsService) {
        const assignments = await manager.find(UserRoleAssignment, {
          where: {
            facilityId: dto.facilityId,
            role: UserRole.FACILITY_MANAGER,
          },
        });
        const activeManagerIds = assignments
          .filter((a) => isAssignmentActive(a))
          .map((a) => a.userId);
        if (activeManagerIds.length > 0) {
          await this.notificationsService.createForUsers(manager, activeManagerIds, {
            type: NotificationType.TOUR_APPOINTMENT_CREATED,
            title: 'Lịch xem kho mới',
            body: `Khách hàng ${dto.fullName.trim()} đã đăng ký xem kho tại ${facility.name} vào ngày ${dto.preferredDate}.`,
            data: { appointmentId: created.id, facilityId: dto.facilityId },
          });
        }
      }

      return created;
    });

    return {
      appointment: toTourAppointmentRecord(await this.findAppointmentOrFail(saved.id)),
    };
  }

  /**
   * List tour appointments based on user role and filters.
   * FACILITY_MANAGER: restricted only to their assigned facilities.
   * FACILITY_STAFF: restricted only to appointments assigned to them.
   * CUSTOMER: restricted only to their own appointments.
   * ADMIN: can view all facilities and appointments.
   */
  async listAppointments(
    query: ListTourAppointmentsQueryDto,
    actor: AuthUser,
  ): Promise<TourAppointmentListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const qb = this.appointments
      .createQueryBuilder('apt')
      .leftJoinAndSelect('apt.facility', 'facility')
      .leftJoinAndSelect('apt.customer', 'customer')
      .leftJoinAndSelect('apt.storageUnit', 'storageUnit')
      .leftJoinAndSelect('apt.assignee', 'assignee');

    if (isGlobalAppointmentActor(actor)) {
      if (query.facilityId) {
        qb.andWhere('apt.facilityId = :facilityId', { facilityId: query.facilityId });
      }
      if (query.assignedTo) {
        qb.andWhere('apt.assignedTo = :assignedTo', { assignedTo: query.assignedTo });
      }
    } else if (actor.roles.includes(UserRole.FACILITY_MANAGER)) {
      const managedFacilityIds = await this.loadManagedFacilityIds(actor.id);
      if (managedFacilityIds.length === 0) {
        return {
          appointments: [],
          meta: buildPaginationMeta(page, limit, 0),
        };
      }

      if (query.facilityId) {
        if (!managedFacilityIds.includes(query.facilityId)) {
          throw new DomainException(
            ErrorCode.FORBIDDEN,
            'You do not manage this facility',
            HttpStatus.FORBIDDEN,
          );
        }
        qb.andWhere('apt.facilityId = :facilityId', { facilityId: query.facilityId });
      } else {
        qb.andWhere('apt.facilityId IN (:...managedFacilityIds)', { managedFacilityIds });
      }

      if (query.assignedTo) {
        qb.andWhere('apt.assignedTo = :assignedTo', { assignedTo: query.assignedTo });
      }
    } else if (actor.roles.includes(UserRole.FACILITY_STAFF)) {
      qb.andWhere('apt.assignedTo = :staffId', { staffId: actor.id });
    } else if (actor.roles.includes(UserRole.CUSTOMER)) {
      qb.andWhere('apt.customerId = :customerId', { customerId: actor.id });
    } else {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not have access to tour appointments',
        HttpStatus.FORBIDDEN,
      );
    }

    if (query.status) {
      qb.andWhere('apt.status = :status', { status: query.status });
    }

    if (query.fromDate) {
      qb.andWhere('apt.preferredDate >= :fromDate', { fromDate: query.fromDate });
    }

    if (query.toDate) {
      qb.andWhere('apt.preferredDate <= :toDate', { toDate: query.toDate });
    }

    if (query.search?.trim()) {
      const q = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(apt.fullName) LIKE :search OR apt.phone LIKE :search OR LOWER(apt.email) LIKE :search)',
        { search: q },
      );
    }

    qb.orderBy('apt.preferredDate', 'ASC')
      .addOrderBy('apt.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await qb.getManyAndCount();

    return {
      appointments: rows.map(toTourAppointmentRecord),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  /**
   * Get single appointment by ID with role-based access validation.
   */
  async getAppointment(id: string, actor: AuthUser): Promise<TourAppointmentResponse> {
    const appointment = await this.findAppointmentOrFail(id);
    await this.assertCanAccess(appointment, actor);
    return { appointment: toTourAppointmentRecord(appointment) };
  }

  /**
   * Facility Manager confirms the appointment details with the customer.
   * Can be called on PENDING, CONFIRMED, or ASSIGNED appointments (retains ASSIGNED if already assigned).
   */
  async confirmAppointment(
    id: string,
    dto: ConfirmTourAppointmentDto,
    actor: AuthUser,
  ): Promise<TourAppointmentResponse> {
    if (dto.preferredDate && isPastVietnamTimeSlot(dto.preferredDate, dto.preferredTimeSlot)) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'preferredDate or preferredTimeSlot cannot be in the past',
        HttpStatus.BAD_REQUEST,
      );
    }

    const saved = await this.appointments.manager.transaction(async (manager) => {
      const appointment = await manager.findOne(TourAppointment, {
        where: { id },
        relations: APPOINTMENT_RELATIONS,
        lock: { mode: 'pessimistic_write' },
      });
      if (!appointment) {
        notFound('Tour appointment');
      }

      await this.assertManagesFacility(actor, appointment.facilityId);

      if (
        appointment.status !== TourAppointmentStatus.PENDING &&
        appointment.status !== TourAppointmentStatus.CONFIRMED &&
        appointment.status !== TourAppointmentStatus.ASSIGNED
      ) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          `Cannot confirm an appointment while its status is ${appointment.status}`,
          HttpStatus.CONFLICT,
        );
      }

      if (dto.preferredDate) {
        appointment.preferredDate = dto.preferredDate;
      }
      if (dto.preferredTimeSlot !== undefined) {
        appointment.preferredTimeSlot = dto.preferredTimeSlot?.trim() || null;
      }
      if (dto.managerNotes !== undefined) {
        appointment.managerNotes = dto.managerNotes?.trim() || null;
      }

      // If already ASSIGNED, keep ASSIGNED; otherwise mark CONFIRMED
      if (appointment.status !== TourAppointmentStatus.ASSIGNED) {
        appointment.status = TourAppointmentStatus.CONFIRMED;
      }

      const result = await manager.save(appointment);

      if (this.notificationsService && appointment.customerId) {
        await this.notificationsService.createForUsers(manager, [appointment.customerId], {
          type: NotificationType.TOUR_APPOINTMENT_CONFIRMED,
          title: 'Lịch hẹn xem kho đã được xác nhận',
          body: `Lịch hẹn xem kho tại ${appointment.facility?.name ?? 'chi nhánh'} vào ngày ${appointment.preferredDate} (${appointment.preferredTimeSlot ?? 'trong ngày'}) đã được xác nhận.`,
          data: { appointmentId: appointment.id, facilityId: appointment.facilityId },
        });
      }

      return result;
    });

    return { appointment: toTourAppointmentRecord(saved) };
  }

  /**
   * Facility Manager assigns an active FACILITY_STAFF or FACILITY_MANAGER from the facility to host the tour.
   */
  async assignAppointment(
    id: string,
    dto: AssignTourAppointmentDto,
    actor: AuthUser,
  ): Promise<TourAppointmentResponse> {
    const saved = await this.appointments.manager.transaction(async (manager) => {
      const appointment = await manager.findOne(TourAppointment, {
        where: { id },
        relations: APPOINTMENT_RELATIONS,
        lock: { mode: 'pessimistic_write' },
      });
      if (!appointment) {
        notFound('Tour appointment');
      }

      await this.assertManagesFacility(actor, appointment.facilityId);

      if (
        appointment.status === TourAppointmentStatus.COMPLETED ||
        appointment.status === TourAppointmentStatus.CANCELLED
      ) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          `Cannot assign staff to an appointment that is ${appointment.status}`,
          HttpStatus.CONFLICT,
        );
      }

      const assignee = await manager.findOne(AppUser, {
        where: { id: dto.assignedTo, status: UserStatus.ACTIVE },
      });
      if (!assignee) {
        throw new DomainException(
          ErrorCode.VALIDATION_FAILED,
          'Staff user does not exist or is inactive',
          HttpStatus.BAD_REQUEST,
        );
      }

      const assignments = await manager.find(UserRoleAssignment, {
        where: [
          {
            userId: dto.assignedTo,
            role: UserRole.FACILITY_STAFF,
            facilityId: appointment.facilityId,
          },
          {
            userId: dto.assignedTo,
            role: UserRole.FACILITY_MANAGER,
            facilityId: appointment.facilityId,
          },
        ],
      });

      const isStaffOrManagerActive = assignments.some((a) => isAssignmentActive(a));
      if (!isStaffOrManagerActive) {
        throw new DomainException(
          ErrorCode.VALIDATION_FAILED,
          'User is not an active facility staff or manager member of this facility',
          HttpStatus.BAD_REQUEST,
        );
      }

      appointment.assignedTo = dto.assignedTo;
      // The loaded `assignee` relation wins over `assignedTo` on save, so it must be swapped too.
      appointment.assignee = assignee;
      appointment.status = TourAppointmentStatus.ASSIGNED;

      const result = await manager.save(appointment);

      if (this.notificationsService) {
        await this.notificationsService.createForUsers(manager, [dto.assignedTo], {
          type: NotificationType.TOUR_APPOINTMENT_ASSIGNED,
          title: 'Phân công ca dẫn khách',
          body: `Bạn đã được phân công dẫn khách ${appointment.fullName} tham quan kho vào ngày ${appointment.preferredDate}.`,
          data: { appointmentId: appointment.id, facilityId: appointment.facilityId },
        });
      }

      return result;
    });

    return { appointment: toTourAppointmentRecord(saved) };
  }

  /**
   * Staff (or Manager) completes the tour and records outcome consultation notes.
   */
  async completeAppointment(
    id: string,
    dto: CompleteTourAppointmentDto,
    actor: AuthUser,
  ): Promise<TourAppointmentResponse> {
    const saved = await this.appointments.manager.transaction(async (manager) => {
      const appointment = await manager.findOne(TourAppointment, {
        where: { id },
        relations: APPOINTMENT_RELATIONS,
        lock: { mode: 'pessimistic_write' },
      });
      if (!appointment) {
        notFound('Tour appointment');
      }

      await this.assertCanCompleteAppointment(appointment, actor);

      if (appointment.status === TourAppointmentStatus.COMPLETED) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Appointment is already completed',
          HttpStatus.CONFLICT,
        );
      }

      if (appointment.status === TourAppointmentStatus.CANCELLED) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Cannot complete a cancelled appointment',
          HttpStatus.CONFLICT,
        );
      }

      if (appointment.status === TourAppointmentStatus.PENDING) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Cannot complete an unconfirmed appointment',
          HttpStatus.CONFLICT,
        );
      }

      appointment.status = TourAppointmentStatus.COMPLETED;
      appointment.staffResultNotes = dto.staffResultNotes.trim();

      return manager.save(appointment);
    });

    return { appointment: toTourAppointmentRecord(saved) };
  }

  /**
   * Staff (or Manager, or Customer) cancels the appointment or records a no-show with cancellation reason.
   */
  async cancelAppointment(
    id: string,
    dto: CancelTourAppointmentDto,
    actor: AuthUser,
  ): Promise<TourAppointmentResponse> {
    const saved = await this.appointments.manager.transaction(async (manager) => {
      const appointment = await manager.findOne(TourAppointment, {
        where: { id },
        relations: APPOINTMENT_RELATIONS,
        lock: { mode: 'pessimistic_write' },
      });
      if (!appointment) {
        notFound('Tour appointment');
      }

      await this.assertCanCancelAppointment(appointment, actor);

      if (appointment.status === TourAppointmentStatus.COMPLETED) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Cannot cancel an already completed appointment',
          HttpStatus.CONFLICT,
        );
      }

      if (appointment.status === TourAppointmentStatus.CANCELLED) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Appointment is already cancelled',
          HttpStatus.CONFLICT,
        );
      }

      appointment.status = TourAppointmentStatus.CANCELLED;
      appointment.cancellationReason = dto.cancellationReason.trim();

      const result = await manager.save(appointment);

      if (this.notificationsService) {
        const notifyUserIds: string[] = [];
        const isActorCustomer =
          actor.roles.includes(UserRole.CUSTOMER) && actor.id === appointment.customerId;
        if (isActorCustomer) {
          if (appointment.assignedTo) {
            notifyUserIds.push(appointment.assignedTo);
          }
        } else if (appointment.customerId) {
          notifyUserIds.push(appointment.customerId);
        }
        if (notifyUserIds.length > 0) {
          await this.notificationsService.createForUsers(manager, notifyUserIds, {
            type: NotificationType.TOUR_APPOINTMENT_CANCELLED,
            title: 'Lịch hẹn xem kho đã bị hủy',
            body: `Lịch hẹn xem kho ngày ${appointment.preferredDate} đã bị hủy. Lý do: ${dto.cancellationReason.trim()}`,
            data: { appointmentId: appointment.id, facilityId: appointment.facilityId },
          });
        }
      }

      return result;
    });

    return { appointment: toTourAppointmentRecord(saved) };
  }

  private async findAppointmentOrFail(id: string): Promise<TourAppointment> {
    const appointment = await this.appointments.findOne({
      where: { id },
      relations: APPOINTMENT_RELATIONS,
    });
    if (!appointment) {
      notFound('Tour appointment');
    }
    return appointment;
  }

  private async assertCanAccess(appointment: TourAppointment, actor: AuthUser): Promise<void> {
    if (isGlobalAppointmentActor(actor)) {
      return;
    }
    if (actor.roles.includes(UserRole.FACILITY_STAFF) && appointment.assignedTo === actor.id) {
      return;
    }
    if (actor.roles.includes(UserRole.FACILITY_MANAGER)) {
      const managedFacilityIds = await this.loadManagedFacilityIds(actor.id);
      if (managedFacilityIds.includes(appointment.facilityId)) {
        return;
      }
    }
    if (appointment.customerId && appointment.customerId === actor.id) {
      return;
    }

    throw new DomainException(
      ErrorCode.FORBIDDEN,
      'You do not have access to this appointment',
      HttpStatus.FORBIDDEN,
    );
  }

  private async assertCanCompleteAppointment(
    appointment: TourAppointment,
    actor: AuthUser,
  ): Promise<void> {
    if (isGlobalAppointmentActor(actor)) {
      return;
    }
    if (actor.roles.includes(UserRole.FACILITY_STAFF) && appointment.assignedTo === actor.id) {
      return;
    }
    if (actor.roles.includes(UserRole.FACILITY_MANAGER)) {
      const managedFacilityIds = await this.loadManagedFacilityIds(actor.id);
      if (managedFacilityIds.includes(appointment.facilityId)) {
        return;
      }
    }

    throw new DomainException(
      ErrorCode.FORBIDDEN,
      'Only the assigned staff or facility manager can complete this appointment',
      HttpStatus.FORBIDDEN,
    );
  }

  private async assertCanCancelAppointment(
    appointment: TourAppointment,
    actor: AuthUser,
  ): Promise<void> {
    if (isGlobalAppointmentActor(actor)) {
      return;
    }
    if (actor.roles.includes(UserRole.FACILITY_STAFF) && appointment.assignedTo === actor.id) {
      return;
    }
    if (actor.roles.includes(UserRole.FACILITY_MANAGER)) {
      const managedFacilityIds = await this.loadManagedFacilityIds(actor.id);
      if (managedFacilityIds.includes(appointment.facilityId)) {
        return;
      }
    }
    if (
      actor.roles.includes(UserRole.CUSTOMER) &&
      appointment.customerId &&
      appointment.customerId === actor.id
    ) {
      return;
    }

    throw new DomainException(
      ErrorCode.FORBIDDEN,
      'You do not have permission to cancel this appointment',
      HttpStatus.FORBIDDEN,
    );
  }

  private async assertManagesFacility(actor: AuthUser, facilityId: string): Promise<void> {
    if (isGlobalAppointmentActor(actor)) {
      return;
    }
    const managedFacilityIds = await this.loadManagedFacilityIds(actor.id);
    if (!managedFacilityIds.includes(facilityId)) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not manage the facility this appointment belongs to',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async loadManagedFacilityIds(userId: string): Promise<string[]> {
    const assignments = await this.roleAssignments.find({
      where: {
        userId,
        role: UserRole.FACILITY_MANAGER,
      },
    });
    return activeFacilityIds(assignments);
  }
}
