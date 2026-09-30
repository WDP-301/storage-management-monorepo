import { randomBytes } from 'node:crypto';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { ContractUnit } from '@modules/contracts/entities/contract-unit.entity';
import { AppUser } from '@modules/customer/entities/app-user.entity';
import { UserRoleAssignment } from '@modules/customer/entities/user-role-assignment.entity';
import { Facility } from '@modules/facilities/entities/facility.entity';
import { StorageUnit } from '@modules/facilities/entities/storage-unit.entity';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import {
  ContractStatus,
  ContractUnitStatus,
  TicketPriority,
  TicketStatus,
  UserRole,
  UserStatus,
} from '@storage/types';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { DEFAULT_PAGE_SIZE, ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ServiceTicket } from './entities/service-ticket.entity';
import { TicketType } from './entities/ticket-type.entity';
import type {
  ServiceTicketDeleteResponse,
  ServiceTicketListResponse,
  ServiceTicketResponse,
  TicketHistoryEntry,
} from './types/service-ticket';
import { toServiceTicketRecord } from './types/service-ticket';

const PG_UNIQUE_VIOLATION = '23505';
const MAX_TICKET_NO_ATTEMPTS = 3;
const RESOLVED_STATUSES: readonly TicketStatus[] = [TicketStatus.RESOLVED, TicketStatus.CLOSED];
const ASSIGNABLE_STATUSES: readonly TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
];

@Injectable()
export class ServiceTicketsService {
  constructor(
    @InjectRepository(ServiceTicket)
    private readonly tickets: Repository<ServiceTicket>,
    @InjectRepository(TicketType)
    private readonly ticketTypes: Repository<TicketType>,
    @InjectRepository(UserRoleAssignment)
    private readonly roleAssignments: Repository<UserRoleAssignment>,
    @InjectRepository(AppUser)
    private readonly users: Repository<AppUser>,
    @InjectRepository(Facility)
    private readonly facilities: Repository<Facility>,
    @InjectRepository(StorageUnit)
    private readonly storageUnits: Repository<StorageUnit>,
    @InjectRepository(ContractUnit)
    private readonly contractUnits: Repository<ContractUnit>,
  ) {}

  /**
   * Creates a ticket on behalf of the authenticated customer. The owner is always the
   * session user (`actor.id`), never a client-supplied id; assignment stays null until a
   * facility manager assigns a staff member.
   */
  async create(dto: CreateTicketDto, actor: AuthUser): Promise<ServiceTicketResponse> {
    await this.validateTicketReferences(dto);
    await this.assertCustomerRents(actor.id, dto);

    const ticket = this.tickets.create({
      typeId: dto.typeId,
      facilityId: dto.facilityId,
      storageUnitId: dto.storageUnitId,
      customerId: actor.id,
      priority: dto.priority ?? TicketPriority.NORMAL,
      status: TicketStatus.OPEN,
      subject: dto.subject.trim(),
      description: dto.description,
      attachments: dto.attachments ?? [],
    });

    const saved = await this.saveWithTicketNoRetry(ticket);
    return { ticket: toServiceTicketRecord(await this.findTicketOrFail(saved.id)) };
  }

  /**
   * Lists only the tickets the authenticated user is allowed to see, enforced by an
   * OR-of-scopes WHERE clause (never by post-query filtering):
   * - CUSTOMER → tickets they created
   * - FACILITY_MANAGER → tickets of facilities they manage
   * - FACILITY_STAFF → tickets assigned directly to them
   */
  async list(query: ListTicketsQueryDto, actor: AuthUser): Promise<ServiceTicketListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const branches: string[] = [];
    const params: Record<string, unknown> = {};

    if (actor.roles.includes(UserRole.FACILITY_MANAGER)) {
      const managedFacilityIds = await this.loadManagedFacilityIds(actor.id);
      if (managedFacilityIds.length > 0) {
        branches.push('"ticket"."facility_id" IN (:...managedFacilityIds)');
        params.managedFacilityIds = managedFacilityIds;
      }
    }
    if (actor.roles.includes(UserRole.FACILITY_STAFF)) {
      branches.push('"ticket"."assigned_to" = :staffId');
      params.staffId = actor.id;
    }
    if (actor.roles.includes(UserRole.CUSTOMER)) {
      branches.push('"ticket"."customer_id" = :customerId');
      params.customerId = actor.id;
    }

    if (branches.length === 0) {
      return { tickets: [], meta: { page, limit, total: 0, totalPages: 0 } };
    }

    const [rows, total] = await this.tickets
      .createQueryBuilder('ticket')
      .where(`(${branches.join(' OR ')})`, params)
      .leftJoinAndSelect('ticket.type', 'type')
      .leftJoinAndSelect('ticket.facility', 'facility')
      .leftJoinAndSelect('ticket.storageUnit', 'storageUnit')
      .leftJoinAndSelect('ticket.customer', 'customer')
      .leftJoinAndSelect('ticket.assignee', 'assignee')
      .orderBy('ticket.createdAt', 'DESC')
      .addOrderBy('ticket.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      tickets: rows.map(toServiceTicketRecord),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOne(id: string, actor: AuthUser): Promise<ServiceTicketResponse> {
    const ticket = await this.findTicketOrFail(id);
    await this.assertCanAccess(ticket, actor);

    return { ticket: toServiceTicketRecord(ticket) };
  }

  /**
   * Lets a facility manager assign a staff member of the ticket's facility. The assignee
   * must hold an active FACILITY_STAFF role scoped to `ticket.facility_id`; arbitrary
   * users cannot be assigned.
   */
  async assign(id: string, dto: AssignTicketDto, actor: AuthUser): Promise<ServiceTicketResponse> {
    const ticket = await this.findTicketOrFail(id);
    await this.assertManagesFacility(actor, ticket.facilityId);

    if (!ASSIGNABLE_STATUSES.includes(ticket.status)) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        `Ticket cannot be assigned while its status is ${ticket.status}`,
        HttpStatus.CONFLICT,
      );
    }

    const assignee = await this.users.findOne({
      where: { id: dto.assignedTo, status: UserStatus.ACTIVE },
    });
    if (!assignee) {
      throw this.fieldValidationError('assignedTo', 'notFound', 'Staff user does not exist');
    }

    const staffAssignment = await this.roleAssignments.findOne({
      where: {
        userId: dto.assignedTo,
        role: UserRole.FACILITY_STAFF,
        facilityId: ticket.facilityId,
      },
    });
    if (!staffAssignment || !this.isAssignmentActive(staffAssignment)) {
      throw this.fieldValidationError(
        'assignedTo',
        'notFacilityStaff',
        'User is not an active facility staff member of this facility',
      );
    }

    const previousAssigneeId = ticket.assignedTo ?? null;
    const previousStatus = ticket.status;
    ticket.assignedTo = dto.assignedTo;
    if (ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.ASSIGNED;
    }

    const history = [...(ticket.history ?? [])];
    history.push(this.historyEntry('ASSIGNED', previousAssigneeId, dto.assignedTo, actor.id));
    if (ticket.status !== previousStatus) {
      history.push(this.historyEntry('STATUS_CHANGED', previousStatus, ticket.status, actor.id));
    }
    ticket.history = history;

    const saved = await this.tickets.save(ticket);
    return { ticket: toServiceTicketRecord(await this.findTicketOrFail(saved.id)) };
  }

  /**
   * Lets a staff member update processing fields (status/resolution/attachments) of a
   * ticket assigned to them. `assigned_to`, ownership ids and `resolved_at` are never
   * taken from the request; `resolved_at` is derived from the status transition.
   */
  async update(id: string, dto: UpdateTicketDto, actor: AuthUser): Promise<ServiceTicketResponse> {
    const ticket = await this.findTicketOrFail(id);

    if (ticket.assignedTo !== actor.id) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You can only update tickets assigned to you',
        HttpStatus.FORBIDDEN,
      );
    }

    if (dto.status !== undefined && dto.status !== ticket.status) {
      const previousStatus = ticket.status;
      ticket.status = dto.status;
      ticket.resolvedAt = RESOLVED_STATUSES.includes(dto.status) ? new Date() : null;
      ticket.history = [
        ...(ticket.history ?? []),
        this.historyEntry('STATUS_CHANGED', previousStatus, dto.status, actor.id),
      ];
    }

    if (dto.resolution !== undefined) {
      ticket.resolution = dto.resolution;
    }
    if (dto.attachments !== undefined) {
      ticket.attachments = dto.attachments;
    }

    const saved = await this.tickets.save(ticket);
    return { ticket: toServiceTicketRecord(await this.findTicketOrFail(saved.id)) };
  }

  /**
   * Deletes a ticket. ADMIN may delete any ticket; FACILITY_MANAGER only tickets of
   * facilities they manage.
   */
  async remove(id: string, actor: AuthUser): Promise<ServiceTicketDeleteResponse> {
    const ticket = await this.findTicketOrFail(id);

    if (!actor.roles.includes(UserRole.ADMIN)) {
      await this.assertManagesFacility(actor, ticket.facilityId);
    }

    const result = await this.tickets.delete({ id: ticket.id });
    return { deleted: (result.affected ?? 0) > 0, id: ticket.id };
  }

  /**
   * Blocks ticket creation when the customer has no active contract covering the unit,
   * or any unit of the facility when no storageUnitId is provided.
   */
  private async assertCustomerRents(
    customerId: string,
    dto: Pick<CreateTicketDto, 'facilityId' | 'storageUnitId'>,
  ): Promise<void> {
    const now = new Date();

    const builder = this.contractUnits
      .createQueryBuilder('cu')
      .innerJoin('cu.contract', 'c')
      .where('c.customerId = :customerId', { customerId })
      .andWhere('c.status = :contractStatus', { contractStatus: ContractStatus.ACTIVE })
      .andWhere('cu.status = :unitStatus', { unitStatus: ContractUnitStatus.ACTIVE })
      .andWhere('cu.startAt <= :now', { now })
      .andWhere('cu.endAt >= :now', { now });

    if (dto.storageUnitId) {
      builder.andWhere('cu.storageUnitId = :unitId', { unitId: dto.storageUnitId });
    } else {
      builder
        .innerJoin('cu.storageUnit', 'su')
        .andWhere('su.facilityId = :facilityId', { facilityId: dto.facilityId });
    }

    if (!(await builder.getExists())) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        dto.storageUnitId
          ? 'You can only create tickets for units you are actively renting'
          : 'You can only create tickets for facilities where you are actively renting',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async findTicketOrFail(id: string): Promise<ServiceTicket> {
    const ticket = await this.tickets.findOne({
      where: { id },
      relations: { type: true, facility: true, storageUnit: true, customer: true, assignee: true },
    });

    if (!ticket) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Ticket not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return ticket;
  }

  /** Shared visibility rule for single-ticket access (CUSTOMER owner, MANAGER facility, STAFF assignee). */
  private async assertCanAccess(ticket: ServiceTicket, actor: AuthUser): Promise<void> {
    if (actor.roles.includes(UserRole.CUSTOMER) && ticket.customerId === actor.id) {
      return;
    }
    if (actor.roles.includes(UserRole.FACILITY_STAFF) && ticket.assignedTo === actor.id) {
      return;
    }
    if (actor.roles.includes(UserRole.FACILITY_MANAGER)) {
      const managedFacilityIds = await this.loadManagedFacilityIds(actor.id);
      if (managedFacilityIds.includes(ticket.facilityId)) {
        return;
      }
    }

    throw new DomainException(
      ErrorCode.FORBIDDEN,
      'You do not have access to this ticket',
      HttpStatus.FORBIDDEN,
    );
  }

  private async assertManagesFacility(actor: AuthUser, facilityId: string): Promise<void> {
    const managedFacilityIds = await this.loadManagedFacilityIds(actor.id);

    if (!managedFacilityIds.includes(facilityId)) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not manage the facility this ticket belongs to',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  /** Active FACILITY_MANAGER assignments of a user → the facility ids they manage. */
  private async loadManagedFacilityIds(userId: string): Promise<string[]> {
    const assignments = await this.roleAssignments.find({
      where: { userId, role: UserRole.FACILITY_MANAGER },
    });

    return assignments
      .filter((assignment) => assignment.facilityId && this.isAssignmentActive(assignment))
      .map((assignment) => assignment.facilityId as string);
  }

  private isAssignmentActive(assignment: UserRoleAssignment): boolean {
    const now = Date.now();
    return (
      assignment.startsAt.getTime() <= now &&
      (!assignment.endsAt || assignment.endsAt.getTime() > now)
    );
  }

  private async validateTicketReferences(dto: CreateTicketDto): Promise<void> {
    const facility = await this.facilities.findOne({
      where: { id: dto.facilityId, deletedAt: IsNull() },
    });
    if (!facility) {
      throw this.fieldValidationError('facilityId', 'notFound', 'Facility does not exist');
    }

    const type = await this.ticketTypes.findOne({ where: { id: dto.typeId } });
    if (!type) {
      throw this.fieldValidationError('typeId', 'notFound', 'Ticket type does not exist');
    }
    if (!type.isActive) {
      throw this.fieldValidationError('typeId', 'inactive', 'Ticket type is not active');
    }

    if (dto.storageUnitId) {
      const unit = await this.storageUnits.findOne({
        where: { id: dto.storageUnitId, deletedAt: IsNull() },
      });
      if (!unit) {
        throw this.fieldValidationError('storageUnitId', 'notFound', 'Storage unit does not exist');
      }
      if (unit.facilityId !== dto.facilityId) {
        throw this.fieldValidationError(
          'storageUnitId',
          'notBelongsToFacility',
          'Storage unit does not belong to the selected facility',
        );
      }
    }
  }

  /** Inserts the ticket, regenerating `ticket_no` on a unique-violation collision. */
  private async saveWithTicketNoRetry(ticket: ServiceTicket): Promise<ServiceTicket> {
    for (let attempt = 1; ; attempt++) {
      ticket.ticketNo = this.generateTicketNo();
      try {
        return await this.tickets.save(ticket);
      } catch (error) {
        if (attempt >= MAX_TICKET_NO_ATTEMPTS || !isUniqueViolation(error)) {
          throw error;
        }
      }
    }
  }

  private generateTicketNo(): string {
    const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    return `ST-${datePart}-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private historyEntry(
    action: string,
    from: string | null,
    to: string,
    by: string,
  ): TicketHistoryEntry {
    return { action, from, to, at: new Date().toISOString(), by };
  }

  private fieldValidationError(field: string, code: string, message: string): DomainException {
    return new DomainException(
      ErrorCode.VALIDATION_FAILED,
      'Validation failed',
      HttpStatus.BAD_REQUEST,
      { fields: [{ field, code, message }] },
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = (error as QueryFailedError & { driverError?: { code?: string } }).driverError;
  return driverError?.code === PG_UNIQUE_VIOLATION;
}
