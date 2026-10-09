import { randomBytes } from 'node:crypto';
import { AppUser } from '@entities/app-user.entity';
import { Contract } from '@entities/contract.entity';
import { Facility } from '@entities/facility.entity';
import { IdempotencyKey } from '@entities/idempotency-key.entity';
import { ServiceTicket } from '@entities/service-ticket.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { TicketType } from '@entities/ticket-type.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { isAssignmentActive } from '@modules/auth/role-assignment.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { buildPaginationMeta, ErrorCode } from '@shared/models/api-response';
import { hashBody } from '@shared/utils/canonical-json.util';
import { claimIdempotencyKey, releaseIdempotencyKey } from '@shared/utils/idempotency-key.util';
import { isUniqueViolation } from '@shared/utils/pg-error.util';
import {
  ContractStatus,
  IdempotencyStatus,
  TicketPriority,
  TicketStatus,
  UserRole,
  UserStatus,
} from '@storage/types';
import { DataSource, IsNull, Repository } from 'typeorm';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { DEFAULT_PAGE_SIZE, ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import type {
  ServiceTicketDeleteResponse,
  ServiceTicketListResponse,
  ServiceTicketResponse,
  TicketFacilityInfo,
  TicketFormOptionsResponse,
  TicketHistoryEntry,
  TicketStorageUnitInfo,
} from './types/service-ticket';
import { toServiceTicketRecord } from './types/service-ticket';

const MAX_TICKET_NO_ATTEMPTS = 3;
/** Staff workflow order — update() only moves a ticket forward along this path. */
const STATUS_FLOW: readonly TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
  TicketStatus.RESOLVED,
];
/** RESOLVED already means done — CLOSED is a separate end state, not a step after it. */
const TERMINAL_STATUSES: readonly TicketStatus[] = [
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
  TicketStatus.CANCELLED,
];
const ASSIGNABLE_STATUSES: readonly TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
];

const TICKET_RELATIONS = {
  type: true,
  facility: true,
  storageUnit: true,
  customer: true,
  assignee: true,
} as const;

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
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
    @InjectRepository(IdempotencyKey)
    private readonly idempotencyKeys: Repository<IdempotencyKey>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Creates a ticket on behalf of the authenticated customer. The owner is always the
   * session user (`actor.id`), never a client-supplied id; assignment stays null until a
   * facility manager assigns a staff member. Idempotent via `Idempotency-Key`: a retry
   * with the same key and payload returns the originally created ticket.
   */
  async create(
    dto: CreateTicketDto,
    actor: AuthUser,
    idempotencyKey: string,
  ): Promise<{ data: ServiceTicketResponse; isRetry: boolean }> {
    const requestHash = hashBody(dto as unknown as Record<string, unknown>);
    const cached = await claimIdempotencyKey(
      this.idempotencyKeys,
      idempotencyKey,
      actor.id,
      requestHash,
    );
    if (cached) {
      return { data: cached as unknown as ServiceTicketResponse, isRetry: true };
    }

    let isCommitted = false;
    try {
      await this.validateTicketReferences(dto);
      await this.assertCustomerRents(actor.id, dto);

      // Ticket insert and the DONE marker commit in one transaction; each ticket_no
      // retry runs a fresh transaction because a failed statement aborts the current one.
      const data = await this.saveWithTicketNoRetry(
        {
          typeId: dto.typeId,
          facilityId: dto.facilityId,
          storageUnitId: dto.storageUnitId,
          customerId: actor.id,
          priority: dto.priority ?? TicketPriority.NORMAL,
          status: TicketStatus.OPEN,
          subject: dto.subject.trim(),
          description: dto.description,
          attachments: dto.attachments ?? [],
        },
        idempotencyKey,
        actor.id,
      );

      isCommitted = true;
      return { data, isRetry: false };
    } catch (error) {
      if (!isCommitted) {
        await releaseIdempotencyKey(this.idempotencyKeys, idempotencyKey, actor.id);
      }
      throw error;
    }
  }

  /**
   * Lists only the tickets the authenticated user is allowed to see, enforced by an
   * OR-of-scopes WHERE clause (never by post-query filtering):
   * - ADMIN → all tickets
   * - CUSTOMER → tickets they created
   * - FACILITY_MANAGER → tickets of facilities they manage
   * - FACILITY_STAFF → tickets assigned directly to them
   */
  async list(query: ListTicketsQueryDto, actor: AuthUser): Promise<ServiceTicketListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const branches: string[] = [];
    const params: Record<string, unknown> = {};
    const isAdmin = actor.roles.includes(UserRole.ADMIN);

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

    if (!isAdmin && branches.length === 0) {
      return { tickets: [], meta: buildPaginationMeta(page, limit, 0) };
    }

    const builder = this.tickets
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.type', 'type')
      .leftJoinAndSelect('ticket.facility', 'facility')
      .leftJoinAndSelect('ticket.storageUnit', 'storageUnit')
      .leftJoinAndSelect('ticket.customer', 'customer')
      .leftJoinAndSelect('ticket.assignee', 'assignee')
      .orderBy('ticket.createdAt', 'DESC')
      .addOrderBy('ticket.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (!isAdmin) {
      builder.where(`(${branches.join(' OR ')})`, params);
    }

    if (query.status) {
      builder.andWhere('ticket.status = :status', { status: query.status });
    }
    if (query.priority) {
      builder.andWhere('ticket.priority = :priority', { priority: query.priority });
    }
    if (query.typeId) {
      builder.andWhere('ticket.type_id = :typeId', { typeId: query.typeId });
    }

    const [rows, total] = await builder.getManyAndCount();

    return {
      tickets: rows.map(toServiceTicketRecord),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getOne(id: string, actor: AuthUser): Promise<ServiceTicketResponse> {
    const ticket = await this.findTicketOrFail(id);
    await this.assertCanAccess(ticket, actor);

    return { ticket: toServiceTicketRecord(ticket) };
  }

  /**
   * Options backing the customer create-ticket form: active ticket types plus the
   * facilities and units the customer may file against. Mirrors the rental rules in
   * `assertCustomerRents` — a unit needs an ACTIVE in-window contract, a facility also
   * accepts an ENDED one — so an option offered here always survives create validation.
   */
  async formOptions(actor: AuthUser): Promise<TicketFormOptionsResponse> {
    const now = new Date();

    const types = await this.ticketTypes.find({
      where: { isActive: true, deletedAt: IsNull() },
      order: { code: 'ASC' },
    });

    const facilityRows = await this.contracts
      .createQueryBuilder('c')
      .innerJoin('c.bookingItem', 'bi')
      .innerJoin('bi.storageUnit', 'su')
      .innerJoin('su.facility', 'f')
      .select(['f.id AS "id"', 'f.code AS "code"', 'f.name AS "name"'])
      .distinct(true)
      .where('c.customerId = :customerId', { customerId: actor.id })
      .andWhere('f.deletedAt IS NULL')
      .andWhere(
        '(c.status = :endedStatus OR (c.status = :activeStatus AND c.effectiveAt <= :now AND (c.endedAt IS NULL OR c.endedAt >= :now)))',
        { endedStatus: ContractStatus.ENDED, activeStatus: ContractStatus.ACTIVE, now },
      )
      .orderBy('f.name', 'ASC')
      .getRawMany<TicketFacilityInfo>();

    const unitRows = await this.contracts
      .createQueryBuilder('c')
      .innerJoin('c.bookingItem', 'bi')
      .innerJoin('bi.storageUnit', 'su')
      .select([
        'su.id AS "id"',
        'su.code AS "code"',
        'su.name AS "name"',
        'su.facilityId AS "facilityId"',
      ])
      .distinct(true)
      .where('c.customerId = :customerId', { customerId: actor.id })
      .andWhere('su.deletedAt IS NULL')
      .andWhere('c.status = :activeStatus', { activeStatus: ContractStatus.ACTIVE })
      .andWhere('c.effectiveAt <= :now', { now })
      .andWhere('(c.endedAt IS NULL OR c.endedAt >= :now)', { now })
      .orderBy('su.code', 'ASC')
      .getRawMany<TicketStorageUnitInfo & { facilityId: string }>();

    const unitsByFacility = new Map<string, TicketStorageUnitInfo[]>();
    for (const { facilityId, ...unit } of unitRows) {
      const units = unitsByFacility.get(facilityId) ?? [];
      units.push(unit);
      unitsByFacility.set(facilityId, units);
    }

    return {
      options: {
        types: types.map(({ id, code, name }) => ({ id, code, name })),
        facilities: facilityRows.map((f) => ({
          ...f,
          units: unitsByFacility.get(f.id) ?? [],
        })),
      },
    };
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
    if (!staffAssignment || !isAssignmentActive(staffAssignment)) {
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
    history.push(this.historyEntry('ASSIGNED', previousAssigneeId, assignee.fullName, actor.id));
    if (ticket.status !== previousStatus) {
      history.push(this.historyEntry('STATUS_CHANGED', previousStatus, ticket.status, actor.id));
    }
    ticket.history = history;

    const saved = await this.tickets.save(ticket);
    return { ticket: toServiceTicketRecord(await this.findTicketOrFail(saved.id)) };
  }

  /**
   * Lets a staff member update processing fields (status/priority/resolution/attachments)
   * of a ticket assigned to them. `assigned_to`, ownership ids and `resolved_at` are never
   * taken from the request; `resolved_at` is derived from the status transition. CANCELLED
   * belongs to the cancel endpoint (owner/manager authorization), and terminal tickets
   * are immutable. Status only moves forward along STATUS_FLOW; CLOSED stays settable as
   * its own end state (e.g. dropped or resolved informally) — RESOLVED already ends the
   * ticket, so CLOSED never follows it.
   */
  async update(id: string, dto: UpdateTicketDto, actor: AuthUser): Promise<ServiceTicketResponse> {
    const ticket = await this.findTicketOrFail(id);

    // Staff update only tickets assigned to them; facility managers update
    // tickets of facilities they manage; admins update any ticket.
    if (ticket.assignedTo !== actor.id && !actor.roles.includes(UserRole.ADMIN)) {
      if (actor.roles.includes(UserRole.FACILITY_MANAGER)) {
        await this.assertManagesFacility(actor, ticket.facilityId);
      } else {
        throw new DomainException(
          ErrorCode.FORBIDDEN,
          'You can only update tickets assigned to you',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    if (TERMINAL_STATUSES.includes(ticket.status)) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        `Ticket cannot be updated while its status is ${ticket.status}`,
        HttpStatus.CONFLICT,
      );
    }
    if (dto.status === TicketStatus.CANCELLED) {
      throw this.fieldValidationError(
        'status',
        'notAllowed',
        'Cancel via the dedicated cancel endpoint',
      );
    }
    if (
      dto.status !== undefined &&
      dto.status !== ticket.status &&
      dto.status !== TicketStatus.CLOSED &&
      STATUS_FLOW.indexOf(dto.status) < STATUS_FLOW.indexOf(ticket.status)
    ) {
      throw this.fieldValidationError(
        'status',
        'invalidTransition',
        `Cannot move a ${ticket.status} ticket backwards to ${dto.status}`,
      );
    }

    if (dto.status !== undefined && dto.status !== ticket.status) {
      const previousStatus = ticket.status;
      ticket.status = dto.status;
      ticket.resolvedAt = dto.status === TicketStatus.RESOLVED ? new Date() : null;
      ticket.history = [
        ...(ticket.history ?? []),
        this.historyEntry('STATUS_CHANGED', previousStatus, dto.status, actor.id),
      ];
    }

    if (dto.priority !== undefined && dto.priority !== ticket.priority) {
      ticket.history = [
        ...(ticket.history ?? []),
        this.historyEntry('PRIORITY_CHANGED', ticket.priority, dto.priority, actor.id),
      ];
      ticket.priority = dto.priority;
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
   * Cancels a ticket that is still being worked (OPEN/ASSIGNED/IN_PROGRESS). The owning
   * customer may cancel their own ticket; a facility manager may cancel tickets of
   * facilities they manage. Resolved tickets are already done — they cannot be cancelled.
   */
  async cancel(id: string, actor: AuthUser): Promise<ServiceTicketResponse> {
    const ticket = await this.findTicketOrFail(id);

    const isOwner = actor.roles.includes(UserRole.CUSTOMER) && ticket.customerId === actor.id;
    if (!isOwner) {
      if (!actor.roles.includes(UserRole.FACILITY_MANAGER)) {
        throw new DomainException(
          ErrorCode.FORBIDDEN,
          'Only the ticket owner or a facility manager can cancel a ticket',
          HttpStatus.FORBIDDEN,
        );
      }
      await this.assertManagesFacility(actor, ticket.facilityId);
    }

    if (!ASSIGNABLE_STATUSES.includes(ticket.status)) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        `Ticket cannot be cancelled while its status is ${ticket.status}`,
        HttpStatus.CONFLICT,
      );
    }

    const previousStatus = ticket.status;
    ticket.status = TicketStatus.CANCELLED;
    ticket.history = [
      ...(ticket.history ?? []),
      this.historyEntry('STATUS_CHANGED', previousStatus, TicketStatus.CANCELLED, actor.id),
    ];

    const saved = await this.tickets.save(ticket);
    return { ticket: toServiceTicketRecord(await this.findTicketOrFail(saved.id)) };
  }

  /**
   * Hard-deletes a ticket. ADMIN only — tickets are business records tied to contracts and
   * disputes, so everyone else ends a ticket via the cancel flow instead of deleting it.
   */
  async remove(id: string, actor: AuthUser): Promise<ServiceTicketDeleteResponse> {
    const ticket = await this.findTicketOrFail(id);

    if (!actor.roles.includes(UserRole.ADMIN)) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'Only administrators can delete tickets',
        HttpStatus.FORBIDDEN,
      );
    }

    const result = await this.tickets.delete({ id: ticket.id });
    return { deleted: (result.affected ?? 0) > 0, id: ticket.id };
  }

  /**
   * Blocks ticket creation when the customer has no contract covering the target:
   * a unit-scoped ticket needs an ACTIVE contract on that unit, while a facility-level
   * ticket also accepts an ENDED contract (post-moveout complaints, deposit disputes).
   */
  private async assertCustomerRents(
    customerId: string,
    dto: Pick<CreateTicketDto, 'facilityId' | 'storageUnitId'>,
  ): Promise<void> {
    const now = new Date();

    const builder = this.contracts
      .createQueryBuilder('c')
      .innerJoin('c.bookingItem', 'bi')
      .where('c.customerId = :customerId', { customerId });

    if (dto.storageUnitId) {
      builder
        .andWhere('bi.storageUnitId = :unitId', { unitId: dto.storageUnitId })
        .andWhere('c.status = :contractStatus', { contractStatus: ContractStatus.ACTIVE })
        .andWhere('c.effectiveAt <= :now', { now })
        .andWhere('(c.endedAt IS NULL OR c.endedAt >= :now)', { now });
    } else {
      // ponytail: any ENDED contract qualifies regardless of age; add a grace window if abused
      builder
        .innerJoin('bi.storageUnit', 'su')
        .andWhere('su.facilityId = :facilityId', { facilityId: dto.facilityId })
        .andWhere(
          '(c.status = :endedStatus OR (c.status = :activeStatus AND c.effectiveAt <= :now AND (c.endedAt IS NULL OR c.endedAt >= :now)))',
          { endedStatus: ContractStatus.ENDED, activeStatus: ContractStatus.ACTIVE, now },
        );
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
      relations: TICKET_RELATIONS,
    });

    if (!ticket) notFound('Ticket');

    return ticket;
  }

  /** Shared visibility rule for single-ticket access (ADMIN any, CUSTOMER owner, MANAGER facility, STAFF assignee). */
  private async assertCanAccess(ticket: ServiceTicket, actor: AuthUser): Promise<void> {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return;
    }
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
      .filter((assignment) => assignment.facilityId && isAssignmentActive(assignment))
      .map((assignment) => assignment.facilityId as string);
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

  /**
   * Inserts the ticket and marks the idempotency key DONE with the cached response in one
   * transaction; regenerates `ticket_no` and re-runs a fresh transaction on collision.
   */
  private async saveWithTicketNoRetry(
    values: Partial<ServiceTicket>,
    idempotencyKey: string,
    userId: string,
  ): Promise<ServiceTicketResponse> {
    for (let attempt = 1; ; attempt++) {
      const ticket = this.tickets.create({ ...values, ticketNo: this.generateTicketNo() });
      try {
        return await this.dataSource.transaction(async (em) => {
          const saved = await em.save(ticket);
          const full = await em.findOneOrFail(ServiceTicket, {
            where: { id: saved.id },
            relations: TICKET_RELATIONS,
          });
          const body = { ticket: toServiceTicketRecord(full) };
          await em.update(
            IdempotencyKey,
            { key: idempotencyKey, userId },
            {
              status: IdempotencyStatus.DONE,
              responseStatus: HttpStatus.CREATED,
              responseBody: body,
            },
          );
          return body;
        });
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
