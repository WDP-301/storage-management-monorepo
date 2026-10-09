import { AppUser } from '@entities/app-user.entity';
import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { TourAppointment } from '@entities/tour-appointment.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { activeFacilityIds, isAssignmentActive } from '@modules/auth/role-assignment.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { buildPaginationMeta, ErrorCode } from '@shared/models/api-response';
import { TourAppointmentStatus, UserRole, UserStatus } from '@storage/types';
import { Repository } from 'typeorm';
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
          addressLine: apt.facility.addressLine ?? null,
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
    @InjectRepository(Facility)
    private readonly facilities: Repository<Facility>,
    @InjectRepository(StorageUnit)
    private readonly storageUnits: Repository<StorageUnit>,
    @InjectRepository(AppUser)
    private readonly users: Repository<AppUser>,
    @InjectRepository(UserRoleAssignment)
    private readonly roleAssignments: Repository<UserRoleAssignment>,
  ) {}

  /**
   * Public contact form submission to schedule a facility/unit tour.
   * If customer is logged in, their customerId will be linked.
   */
  async createContactRequest(
    dto: CreateContactTourDto,
    customerId?: string | null,
  ): Promise<TourAppointmentResponse> {
    const facility = await this.facilities.findOne({ where: { id: dto.facilityId } });
    if (!facility) {
      notFound('Facility');
    }

    if (dto.storageUnitId) {
      const unit = await this.storageUnits.findOne({
        where: { id: dto.storageUnitId, facilityId: dto.facilityId },
      });
      if (!unit) {
        throw new DomainException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Storage unit does not exist in the requested facility',
          HttpStatus.NOT_FOUND,
        );
      }
    }

    const appointment = this.appointments.create({
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
    });

    const saved = await this.appointments.save(appointment);
    return {
      appointment: toTourAppointmentRecord(await this.findAppointmentOrFail(saved.id)),
    };
  }

  /**
   * List tour appointments based on user role and filters.
   * FACILITY_MANAGER: restricted only to their assigned facilities.
   * FACILITY_STAFF: restricted only to appointments assigned to them.
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

    if (actor.roles.includes(UserRole.ADMIN)) {
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
   */
  async confirmAppointment(
    id: string,
    dto: ConfirmTourAppointmentDto,
    actor: AuthUser,
  ): Promise<TourAppointmentResponse> {
    const appointment = await this.findAppointmentOrFail(id);
    await this.assertManagesFacility(actor, appointment.facilityId);

    if (
      appointment.status !== TourAppointmentStatus.PENDING &&
      appointment.status !== TourAppointmentStatus.CONFIRMED
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
      appointment.preferredTimeSlot = dto.preferredTimeSlot;
    }
    if (dto.managerNotes !== undefined) {
      appointment.managerNotes = dto.managerNotes;
    }

    appointment.status = TourAppointmentStatus.CONFIRMED;

    await this.appointments.save(appointment);
    return { appointment: toTourAppointmentRecord(await this.findAppointmentOrFail(id)) };
  }

  /**
   * Facility Manager assigns an active FACILITY_STAFF from the facility to host the tour.
   */
  async assignAppointment(
    id: string,
    dto: AssignTourAppointmentDto,
    actor: AuthUser,
  ): Promise<TourAppointmentResponse> {
    const appointment = await this.findAppointmentOrFail(id);
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

    const assignee = await this.users.findOne({
      where: { id: dto.assignedTo, status: UserStatus.ACTIVE },
    });
    if (!assignee) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Staff user does not exist or is inactive',
        HttpStatus.BAD_REQUEST,
      );
    }

    const staffAssignments = await this.roleAssignments.find({
      where: {
        userId: dto.assignedTo,
        role: UserRole.FACILITY_STAFF,
        facilityId: appointment.facilityId,
      },
    });

    const isStaffActiveInFacility = staffAssignments.some((a) => isAssignmentActive(a));
    if (!isStaffActiveInFacility) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'User is not an active facility staff member of this facility',
        HttpStatus.BAD_REQUEST,
      );
    }

    appointment.assignedTo = dto.assignedTo;
    // The loaded `assignee` relation wins over `assignedTo` on save, so it must be swapped too.
    appointment.assignee = assignee;
    appointment.status = TourAppointmentStatus.ASSIGNED;

    await this.appointments.save(appointment);
    return { appointment: toTourAppointmentRecord(await this.findAppointmentOrFail(id)) };
  }

  /**
   * Staff (or Manager) completes the tour and records outcome consultation notes.
   */
  async completeAppointment(
    id: string,
    dto: CompleteTourAppointmentDto,
    actor: AuthUser,
  ): Promise<TourAppointmentResponse> {
    const appointment = await this.findAppointmentOrFail(id);
    await this.assertCanOperateAppointment(appointment, actor);

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

    appointment.status = TourAppointmentStatus.COMPLETED;
    appointment.staffResultNotes = dto.staffResultNotes;

    await this.appointments.save(appointment);
    return { appointment: toTourAppointmentRecord(await this.findAppointmentOrFail(id)) };
  }

  /**
   * Staff (or Manager) cancels the appointment or records a no-show with cancellation reason.
   */
  async cancelAppointment(
    id: string,
    dto: CancelTourAppointmentDto,
    actor: AuthUser,
  ): Promise<TourAppointmentResponse> {
    const appointment = await this.findAppointmentOrFail(id);
    await this.assertCanOperateAppointment(appointment, actor);

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
    appointment.cancellationReason = dto.cancellationReason;

    await this.appointments.save(appointment);
    return { appointment: toTourAppointmentRecord(await this.findAppointmentOrFail(id)) };
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
    if (actor.roles.includes(UserRole.ADMIN)) {
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

  private async assertCanOperateAppointment(
    appointment: TourAppointment,
    actor: AuthUser,
  ): Promise<void> {
    if (actor.roles.includes(UserRole.ADMIN)) {
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
      'Only the assigned staff or facility manager can update this appointment result',
      HttpStatus.FORBIDDEN,
    );
  }

  private async assertManagesFacility(actor: AuthUser, facilityId: string): Promise<void> {
    if (actor.roles.includes(UserRole.ADMIN)) {
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
