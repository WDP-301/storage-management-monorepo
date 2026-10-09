import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitChangeRequest } from '@entities/unit-change-request.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { activeFacilityIds } from '@modules/auth/role-assignment.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { SettingsService } from '@modules/settings/settings.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { buildPaginationMeta, ErrorCode } from '@shared/models/api-response';
import {
  ChangeRequestStatus,
  ContractStatus,
  InspectionType,
  StorageUnitStatus,
  UserRole,
} from '@storage/types';
import { DataSource, type EntityManager, IsNull, Repository } from 'typeorm';
import {
  CreateChangeRequestDto,
  DecideChangeRequestDto,
  ListChangeRequestsQueryDto,
} from './dto/change-request.dto';
import type { ChangeRequestListResponse, ChangeRequestResponse } from './types/change-request';
import { toChangeRequestRecord } from './types/change-request';

const DEFAULT_PAGE_SIZE = 20;
/** Statuses where the request still awaits a decision — only one may exist per contract. */
const OPEN_STATUSES: readonly ChangeRequestStatus[] = [
  ChangeRequestStatus.REQUESTED,
  ChangeRequestStatus.PROPOSED,
  ChangeRequestStatus.APPROVED,
  ChangeRequestStatus.TRANSITIONING,
];

const REQUEST_RELATIONS = {
  requester: true,
  oldUnit: true,
  newUnit: true,
} as const;

@Injectable()
export class ChangeRequestsService {
  constructor(
    @InjectRepository(UnitChangeRequest)
    private readonly requests: Repository<UnitChangeRequest>,
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
    @InjectRepository(StorageUnit)
    private readonly storageUnits: Repository<StorageUnit>,
    @InjectRepository(UserRoleAssignment)
    private readonly roleAssignments: Repository<UserRoleAssignment>,
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
  ) {}

  /**
   * OR-of-scopes listing, same pattern as service tickets:
   * ADMIN → all; FACILITY_MANAGER → requests at facilities they manage;
   * CUSTOMER → their own requests.
   */
  async list(
    query: ListChangeRequestsQueryDto,
    actor: AuthUser,
  ): Promise<ChangeRequestListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const branches: string[] = [];
    const params: Record<string, unknown> = {};
    const isAdmin = actor.roles.includes(UserRole.ADMIN);

    if (actor.roles.includes(UserRole.FACILITY_MANAGER)) {
      const managedFacilityIds = await this.loadManagedFacilityIds(actor.id);
      if (managedFacilityIds.length > 0) {
        branches.push('"oldUnit"."facility_id" IN (:...managedFacilityIds)');
        params.managedFacilityIds = managedFacilityIds;
      }
    }
    if (actor.roles.includes(UserRole.CUSTOMER)) {
      branches.push('"request"."requested_by" = :customerId');
      params.customerId = actor.id;
    }

    if (!isAdmin && branches.length === 0) {
      return { requests: [], meta: buildPaginationMeta(page, limit, 0) };
    }

    const builder = this.requests
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.requester', 'requester')
      .leftJoinAndSelect('request.oldUnit', 'oldUnit')
      .leftJoinAndSelect('request.newUnit', 'newUnit')
      .orderBy('request.createdAt', 'DESC')
      .addOrderBy('request.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (!isAdmin) {
      builder.where(`(${branches.join(' OR ')})`, params);
    }

    if (query.status) {
      builder.andWhere('request.status = :status', { status: query.status });
    }

    const [rows, total] = await builder.getManyAndCount();

    return {
      requests: rows.map(toChangeRequestRecord),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  /**
   * Customer asks to move their active contract to another AVAILABLE warehouse. The request
   * carries the price/deposit delta as a quote — decided later by the manager of the
   * warehouse they rent today.
   */
  async create(dto: CreateChangeRequestDto, actor: AuthUser): Promise<ChangeRequestResponse> {
    const contract = await this.contracts.findOne({
      where: { id: dto.contractId, deletedAt: IsNull() },
      relations: { bookingItem: { storageUnit: true } },
    });

    if (!contract || contract.customerId !== actor.id) {
      throw this.fieldError('contractId', 'notFound', 'Contract not found');
    }
    if (contract.status !== ContractStatus.ACTIVE) {
      throw this.fieldError('contractId', 'notActive', 'Contract is not active');
    }

    const oldUnit = contract.bookingItem.storageUnit;
    const newUnit = await this.storageUnits.findOne({
      where: { id: dto.newUnitId, deletedAt: IsNull() },
    });
    if (!newUnit) {
      throw this.fieldError('newUnitId', 'notFound', 'Storage unit does not exist');
    }
    if (newUnit.id === oldUnit.id) {
      throw this.fieldError('newUnitId', 'sameUnit', 'New unit must differ from the current one');
    }
    if (newUnit.status !== StorageUnitStatus.AVAILABLE) {
      throw this.fieldError('newUnitId', 'notAvailable', 'New unit is not available');
    }

    // One open request per contract at a time.
    // ponytail: check-then-insert — concurrent POSTs can both open a request;
    // upgrade path = partial unique index on contract_id over OPEN_STATUSES.
    const openCount = await this.requests
      .createQueryBuilder('r')
      .where('r.contract_id = :contractId', { contractId: contract.id })
      .andWhere('r.status IN (:...openStatuses)', { openStatuses: OPEN_STATUSES })
      .getCount();
    if (openCount > 0) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        'An open change request already exists for this contract',
        HttpStatus.CONFLICT,
      );
    }

    const newPrice = Number(newUnit.monthlyPrice);
    const newDeposit = newPrice * (await this.settings.getDepositMonthsFor(newUnit));
    const rentDifference = newPrice - Number(contract.bookingItem.monthlyPriceSnapshot);
    const depositDifference = newDeposit - Number(contract.bookingItem.depositSnapshot);

    const saved = await this.requests.save(
      this.requests.create({
        contractId: contract.id,
        oldUnitId: oldUnit.id,
        newUnitId: newUnit.id,
        requestedBy: actor.id,
        reason: dto.reason.trim(),
        status: ChangeRequestStatus.REQUESTED,
        rentDifference,
        depositDifference,
        history: [this.historyEntry('REQUESTED', null, ChangeRequestStatus.REQUESTED, actor.id)],
      }),
    );

    return { request: toChangeRequestRecord(await this.findOrFail(saved.id)) };
  }

  /**
   * Facility manager decision on a pending request. REJECTED just marks the request;
   * APPROVED performs the swap atomically — new unit must still be AVAILABLE,
   * so the status flips straight to COMPLETED once the move is done.
   */
  async decide(
    id: string,
    dto: DecideChangeRequestDto,
    actor: AuthUser,
  ): Promise<ChangeRequestResponse> {
    const request = await this.findOrFail(id);
    await this.assertManagesFacility(actor, request.oldUnit.facilityId);

    if (request.status !== ChangeRequestStatus.REQUESTED) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        `Request cannot be decided while its status is ${request.status}`,
        HttpStatus.CONFLICT,
      );
    }

    if (dto.decision === 'REJECTED') {
      request.status = ChangeRequestStatus.REJECTED;
      request.approvedBy = actor.id;
      request.decisionNote = dto.decisionNote;
      request.history = [
        ...(request.history ?? []),
        this.historyEntry(
          'STATUS_CHANGED',
          ChangeRequestStatus.REQUESTED,
          ChangeRequestStatus.REJECTED,
          actor.id,
        ),
      ];
      await this.requests.save(request);
      return { request: toChangeRequestRecord(request) };
    }

    if (!request.newUnitId) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        'Request has no target unit to move into',
        HttpStatus.CONFLICT,
      );
    }

    const contract = await this.contracts.findOne({
      where: { id: request.contractId, deletedAt: IsNull() },
      relations: { bookingItem: true },
    });
    if (!contract || contract.status !== ContractStatus.ACTIVE) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        'Contract is no longer active',
        HttpStatus.CONFLICT,
      );
    }

    const newUnit = request.newUnit;
    if (!newUnit) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        'Target unit no longer exists',
        HttpStatus.CONFLICT,
      );
    }
    const newPrice = Number(newUnit.monthlyPrice);
    const newDeposit = newPrice * (await this.settings.getDepositMonthsFor(newUnit));

    await this.dataSource.transaction(async (manager) => {
      await this.assertContractStillMovable(manager, contract.id, request.oldUnitId);

      // Claim the target unit atomically — if someone else took it, bail out.
      const claimed = await manager
        .createQueryBuilder()
        .update(StorageUnit)
        .set({ status: StorageUnitStatus.RENTED })
        .where('id = :id AND status = :available AND deleted_at IS NULL', {
          id: request.newUnitId,
          available: StorageUnitStatus.AVAILABLE,
        })
        .execute();
      if (!claimed.affected) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Target unit is no longer available',
          HttpStatus.CONFLICT,
        );
      }

      // The customer's goods may still be in the old warehouse; it stays out of the
      // catalogue until staff confirm it is empty and put it back in service.
      await manager.update(
        StorageUnit,
        { id: request.oldUnitId },
        { status: StorageUnitStatus.MAINTENANCE },
      );
      await manager.update(
        BookingItem,
        { id: contract.bookingItemId },
        {
          storageUnitId: request.newUnitId,
          monthlyPriceSnapshot: newPrice,
          depositSnapshot: newDeposit,
        },
      );
      await manager.update(Contract, { id: contract.id }, { monthlyPriceSnapshot: newPrice });

      request.status = ChangeRequestStatus.COMPLETED;
      request.approvedBy = actor.id;
      request.decisionNote = dto.decisionNote;
      request.history = [
        ...(request.history ?? []),
        this.historyEntry(
          'STATUS_CHANGED',
          ChangeRequestStatus.REQUESTED,
          ChangeRequestStatus.COMPLETED,
          actor.id,
        ),
      ];
      await manager.save(request);
    });

    return { request: toChangeRequestRecord(request) };
  }

  /**
   * Under the contract row lock (shared with return and inspection flows): the contract is
   * still active, still on the unit the request was made from, and not mid move-out.
   */
  private async assertContractStillMovable(
    manager: EntityManager,
    contractId: string,
    oldUnitId: string,
  ): Promise<void> {
    const contract = await manager.findOne(Contract, {
      where: { id: contractId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!contract || contract.status !== ContractStatus.ACTIVE) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        'Contract is no longer active',
        HttpStatus.CONFLICT,
      );
    }
    const item = await manager.findOne(BookingItem, { where: { id: contract.bookingItemId } });
    if (item?.storageUnitId !== oldUnitId) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        'Contract has already moved to another warehouse',
        HttpStatus.CONFLICT,
      );
    }
    const openReturns = await manager.count(Inspection, {
      where: { contractId, type: InspectionType.RETURN, finalizedAt: IsNull() },
    });
    if (openReturns > 0) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        'Contract has a return in progress',
        HttpStatus.CONFLICT,
      );
    }
  }

  private async findOrFail(id: string): Promise<UnitChangeRequest> {
    const request = await this.requests.findOne({ where: { id }, relations: REQUEST_RELATIONS });
    if (!request) notFound('Change request');
    return request;
  }

  private async assertManagesFacility(actor: AuthUser, facilityId: string): Promise<void> {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return;
    }
    const managedFacilityIds = await this.loadManagedFacilityIds(actor.id);
    if (!managedFacilityIds.includes(facilityId)) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not manage the facility this request belongs to',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async loadManagedFacilityIds(userId: string): Promise<string[]> {
    const assignments = await this.roleAssignments.find({
      where: { userId, role: UserRole.FACILITY_MANAGER },
    });
    return activeFacilityIds(assignments);
  }

  private historyEntry(
    action: string,
    from: string | null,
    to: string,
    by: string,
  ): Record<string, unknown> {
    return { action, from, to, at: new Date().toISOString(), by };
  }

  private fieldError(field: string, code: string, message: string): DomainException {
    return new DomainException(
      ErrorCode.VALIDATION_FAILED,
      'Validation failed',
      HttpStatus.BAD_REQUEST,
      {
        fields: [{ field, code, message }],
      },
    );
  }
}
