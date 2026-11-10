import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Facility } from '@entities/facility.entity';
import { Inspection } from '@entities/inspection.entity';
import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitChangeRequest } from '@entities/unit-change-request.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { activeFacilityIds, isAssignmentActive } from '@modules/auth/role-assignment.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { findUnrentable, lockShelfParents } from '@modules/bookings/rentable-units.util';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { generateInvoiceNo } from '@modules/payments/invoice-no.util';
import { SettingsService } from '@modules/settings/settings.service';
import {
  assertShelfEmpty,
  cancelOpenPickupRequests,
} from '@modules/shelf-storage/shelf-empty-guard.util';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { buildPaginationMeta, ErrorCode } from '@shared/models/api-response';
import { addVietnamDays, vietnamDate, vietnamToday } from '@shared/utils/calendar.util';
import { isUniqueViolation } from '@shared/utils/pg-error.util';
import {
  ChangeRequestStatus,
  ContractStatus,
  FacilityStatus,
  InspectionType,
  InvoiceItemType,
  InvoiceKind,
  InvoiceStatus,
  NotificationType,
  StorageUnitKind,
  StorageUnitStatus,
  UserRole,
} from '@storage/types';
import { DataSource, type EntityManager, IsNull, Repository } from 'typeorm';
import { releaseMoveHold } from './change-request-release.util';
import {
  ChangeRequestOptionsQueryDto,
  CreateChangeRequestDto,
  DecideChangeRequestDto,
  ListChangeRequestsQueryDto,
} from './dto/change-request.dto';
import type {
  ChangeRequestListResponse,
  ChangeRequestOption,
  ChangeRequestOptionsResponse,
  ChangeRequestResponse,
} from './types/change-request';
import { toChangeRequestRecord } from './types/change-request';

const DEFAULT_PAGE_SIZE = 20;
const OPTIONS_PAGE_SIZE = 50;
/** How far ahead a move day can be booked, in days. */
export const MOVE_MAX_DAYS_AHEAD = 90;
/** A deposit top-up is due the sooner of the move day or this many days after approval. */
const TOP_UP_DUE_DAYS = 7;
/** Statuses where the request still awaits a decision — only one may exist per contract. */
const OPEN_STATUSES: readonly ChangeRequestStatus[] = [
  ChangeRequestStatus.REQUESTED,
  ChangeRequestStatus.PROPOSED,
  ChangeRequestStatus.APPROVED,
  ChangeRequestStatus.TRANSITIONING,
];
/** A customer withdraws their own request only before anyone decided on it. */
const CUSTOMER_CANCELLABLE: readonly ChangeRequestStatus[] = [ChangeRequestStatus.REQUESTED];
/** The branch takes a request back at any point before the swap is done. */
const MANAGER_CANCELLABLE: readonly ChangeRequestStatus[] = [
  ChangeRequestStatus.REQUESTED,
  ChangeRequestStatus.APPROVED,
  ChangeRequestStatus.TRANSITIONING,
];
/** Approved requests waiting for (or in) the physical move. */
const MOVE_IN_FLIGHT: readonly ChangeRequestStatus[] = [
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
    private readonly notifications: NotificationsService,
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
        // Both ends matter: the facility being left owns the contract, the destination
        // facility owns the held unit and receives the move.
        branches.push('"oldUnit"."facility_id" IN (:...managedFacilityIds)');
        branches.push('"newUnit"."facility_id" IN (:...managedFacilityIds)');
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
   * Units the contract could move to — same kind, AVAILABLE, rentable, in an active facility —
   * each with the rent and deposit delta it would carry. The caller's own contract only.
   */
  async options(
    query: ChangeRequestOptionsQueryDto,
    actor: AuthUser,
  ): Promise<ChangeRequestOptionsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? OPTIONS_PAGE_SIZE;
    const contract = await this.contracts.findOne({
      where: { id: query.contractId, deletedAt: IsNull() },
      relations: { bookingItem: { storageUnit: true } },
    });
    if (!contract || contract.customerId !== actor.id) {
      throw this.fieldError('contractId', 'notFound', 'Contract not found');
    }
    if (contract.status !== ContractStatus.ACTIVE) {
      throw this.fieldError('contractId', 'notActive', 'Contract is not active');
    }

    const oldUnit = contract.bookingItem.storageUnit;
    const candidates = await this.storageUnits.find({
      where: {
        kind: oldUnit.kind,
        status: StorageUnitStatus.AVAILABLE,
        deletedAt: IsNull(),
        facility: { status: FacilityStatus.ACTIVE },
      },
      relations: { facility: true, parent: true },
      order: { facilityId: 'ASC', code: 'ASC' },
    });
    const unrentable = new Set(findUnrentable(candidates));
    const eligible = candidates.filter(
      (unit) => unit.id !== oldUnit.id && !unrentable.has(unit.id),
    );

    // getDepositMonthsFor reads a stored default for units without their own level — cached once.
    let defaultDepositMonths: number | null = null;
    const options: ChangeRequestOption[] = [];
    for (const unit of eligible) {
      const monthlyPrice = Number(unit.monthlyPrice);
      if (unit.depositMonths == null && defaultDepositMonths === null) {
        defaultDepositMonths = await this.settings.getDepositDefaultMonths();
      }
      const depositMonths = unit.depositMonths ?? defaultDepositMonths;
      const deposit = monthlyPrice * depositMonths;
      options.push({
        unit: {
          id: unit.id,
          code: unit.code,
          name: unit.name,
          facility_id: unit.facilityId,
          facility_name: unit.facility?.name ?? '',
          monthly_price: monthlyPrice,
          area_m2: unit.areaM2 == null ? null : Number(unit.areaM2),
        },
        rent_difference: monthlyPrice - Number(contract.bookingItem.monthlyPriceSnapshot),
        deposit_difference: deposit - Number(contract.bookingItem.depositSnapshot),
      });
    }

    return {
      options: options.slice((page - 1) * limit, page * limit),
      meta: buildPaginationMeta(page, limit, options.length),
    };
  }

  /**
   * Customer asks to move their active contract to another AVAILABLE warehouse of the same
   * kind, on a day they pick. The request carries the price/deposit delta as a quote —
   * decided later by the manager of the warehouse they rent today.
   */
  async create(dto: CreateChangeRequestDto, actor: AuthUser): Promise<ChangeRequestResponse> {
    const now = new Date();
    const moveAt = new Date(dto.scheduledMoveAt);
    assertMoveDayInRange('scheduledMoveAt', moveAt, now);

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
    // A contract on its way out cannot move — re-checked under the contract lock on approval.
    const openReturns = await this.dataSource.getRepository(Inspection).count({
      where: { contractId: contract.id, type: InspectionType.RETURN, finalizedAt: IsNull() },
    });
    if (openReturns > 0) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        'Contract has a return in progress',
        HttpStatus.CONFLICT,
      );
    }

    const oldUnit = contract.bookingItem.storageUnit;
    const newUnit = await this.storageUnits.findOne({
      where: { id: dto.newUnitId, deletedAt: IsNull() },
      relations: { facility: true, parent: true },
    });
    if (!newUnit) {
      throw this.fieldError('newUnitId', 'notFound', 'Storage unit does not exist');
    }
    if (newUnit.id === oldUnit.id) {
      throw this.fieldError('newUnitId', 'sameUnit', 'New unit must differ from the current one');
    }
    // The goods move as stored: a shelf's stock cannot be carried into a self-storage unit.
    if (newUnit.kind !== oldUnit.kind) {
      throw this.fieldError(
        'newUnitId',
        'kindMismatch',
        'New unit must be the same kind as the current one',
      );
    }
    if (newUnit.status !== StorageUnitStatus.AVAILABLE) {
      throw this.fieldError('newUnitId', 'notAvailable', 'New unit is not available');
    }
    if (newUnit.facility?.status !== FacilityStatus.ACTIVE) {
      throw this.fieldError('newUnitId', 'notAvailable', 'New unit is not available');
    }
    // A shelf warehouse is only a container; a shelf is closed together with its parent.
    if (findUnrentable([newUnit]).length > 0) {
      throw this.fieldError('newUnitId', 'notAvailable', 'New unit is not available');
    }

    // One open request per contract at a time — enforced by UQ_open_change_request, the
    // partial unique index over the open statuses; the count below is only the friendly error.
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

    let saved: UnitChangeRequest;
    try {
      saved = await this.requests.save(
        this.requests.create({
          contractId: contract.id,
          oldUnitId: oldUnit.id,
          newUnitId: newUnit.id,
          requestedBy: actor.id,
          reason: dto.reason.trim(),
          moveAt,
          status: ChangeRequestStatus.REQUESTED,
          rentDifference,
          depositDifference,
          history: [
            this.historyEntry('REQUESTED', null, ChangeRequestStatus.REQUESTED, actor.id, {
              moveAt: moveAt.toISOString(),
            }),
          ],
        }),
      );
    } catch (err) {
      // Lost the race against the partial unique index UQ_open_change_request.
      if (isUniqueViolation(err)) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'An open change request already exists for this contract',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }

    return { request: toChangeRequestRecord(await this.findOrFail(saved.id)) };
  }

  /**
   * Facility manager decision on a pending request. REJECTED just marks the request and tells
   * the customer. APPROVED confirms the move day, holds the target unit (AVAILABLE → HELD)
   * and bills any deposit top-up — the swap itself happens on `complete`.
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
      await this.dataSource.transaction(async (manager) => {
        await this.lockUndecidedRequest(manager, request.id);
        await manager.save(request);
        await this.notifications.createForUsers(manager, [request.requestedBy], {
          type: NotificationType.UNIT_CHANGE_REJECTED,
          title: 'Yêu cầu đổi kho bị từ chối',
          body:
            `Yêu cầu đổi sang kho ${request.newUnit?.code ?? ''} đã bị từ chối.` +
            (dto.decisionNote ? ` Lý do: ${dto.decisionNote}` : ''),
          data: { requestId: request.id, contractId: request.contractId },
        });
      });
      return { request: toChangeRequestRecord(request) };
    }

    if (!request.newUnitId || !request.newUnit) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        'Request has no target unit to move into',
        HttpStatus.CONFLICT,
      );
    }
    // Requests written before the same-kind rule may aim anywhere — they cannot be approved.
    if (request.newUnit.kind !== request.oldUnit.kind) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        'New unit must be the same kind as the current one',
        HttpStatus.CONFLICT,
      );
    }

    const now = new Date();
    // The approver may move the day; requests written before scheduling carry none.
    const moveAt = dto.moveAt ? new Date(dto.moveAt) : request.moveAt;
    if (!moveAt) {
      throw this.fieldError('moveAt', 'required', 'Chọn ngày chuyển cho yêu cầu này');
    }
    assertMoveDayInRange('moveAt', moveAt, now);

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

    await this.dataSource.transaction(async (manager) => {
      await this.lockUndecidedRequest(manager, request.id);
      await this.assertContractStillMovable(manager, contract.id, request.oldUnitId);
      // Requests written before the same-kind rule may still aim at a non-shelf unit: goods on
      // the shelf cannot move there, and open pick-up requests would become unreachable.
      if (request.newUnit!.kind !== StorageUnitKind.SHELF) {
        await assertShelfEmpty(manager, contract.id, 'UNIT_CHANGE');
        await cancelOpenPickupRequests(manager, contract.id);
      }

      // Shared facility lock first (same order as warehouse writes): a concurrent deactivation
      // waits for this commit, and the unit's facility is pinned in the claim below.
      const targetFacility = await manager.findOne(Facility, {
        where: { id: request.newUnit!.facilityId },
        lock: { mode: 'pessimistic_read' },
      });
      if (!targetFacility || targetFacility.status !== FacilityStatus.ACTIVE) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Target unit facility is not active',
          HttpStatus.CONFLICT,
        );
      }

      // A shelf's building is share-locked before the claim (building before shelves, as in
      // warehouse writes), so closing it concurrently waits and the EXISTS below sees the result.
      await lockShelfParents(manager, [request.newUnit!]);

      // Hold the target until the move: nobody can book it, but the swap has not happened.
      const claimed = await manager
        .createQueryBuilder()
        .update(StorageUnit)
        .set({ status: StorageUnitStatus.HELD })
        .where(
          `id = :id AND facility_id = :facilityId AND status = :available AND deleted_at IS NULL
           AND kind <> :shelfWarehouse
           AND (parent_id IS NULL OR EXISTS (
             SELECT 1 FROM storage_units p
             WHERE p.id = storage_units.parent_id AND p.status = :available AND p.deleted_at IS NULL
           ))`,
          {
            id: request.newUnitId,
            facilityId: targetFacility.id,
            available: StorageUnitStatus.AVAILABLE,
            shelfWarehouse: StorageUnitKind.SHELF_WAREHOUSE,
          },
        )
        .execute();
      if (!claimed.affected) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Target unit is no longer available',
          HttpStatus.CONFLICT,
        );
      }

      // Moving up-market raises the required deposit: bill the difference on a top-up invoice
      // due on the move day. Extra paid money lands in the held deposit; a cheaper unit keeps
      // the surplus for the end-of-contract settlement instead of refunding mid-term.
      const target = await manager.findOneByOrFail(StorageUnit, { id: request.newUnitId });
      const newPrice = Number(target.monthlyPrice);
      const newDeposit = newPrice * (await this.settings.getDepositMonthsFor(target));
      const item = await manager.findOne(BookingItem, { where: { id: contract.bookingItemId } });
      const depositTopUp = newDeposit - Number(item?.depositSnapshot ?? 0);
      // The deltas approved here are re-checked at complete: re-pricing a HELD unit would
      // otherwise slip money the top-up never billed.
      request.rentDifference = newPrice - Number(item?.monthlyPriceSnapshot ?? 0);
      request.depositDifference = depositTopUp;
      if (depositTopUp > 0) {
        // Due on the move day, but never more than TOP_UP_DUE_DAYS out — a move booked
        // months ahead cannot defer the deposit to match.
        const dueAt = new Date(
          Math.min(moveAt.getTime(), now.getTime() + TOP_UP_DUE_DAYS * 86_400_000),
        );
        const invoice = await manager.save(
          Invoice,
          manager.create(Invoice, {
            invoiceNo: generateInvoiceNo(),
            customerId: contract.customerId,
            contractId: contract.id,
            periodNo: 0,
            kind: InvoiceKind.DEPOSIT_TOPUP,
            months: 0,
            monthlyPriceSnapshot: newPrice,
            status: InvoiceStatus.ISSUED,
            currency: 'VND',
            subtotal: depositTopUp,
            taxAmount: 0,
            total: depositTopUp,
            issuedAt: new Date(),
            dueAt,
            billingInfo: {},
          }),
        );
        await manager.save(
          InvoiceItem,
          manager.create(InvoiceItem, {
            invoiceId: invoice.id,
            storageUnitId: request.newUnitId,
            itemType: InvoiceItemType.DEPOSIT,
            description: `Thu bù tiền cọc do đổi sang kho ${target.code} (HĐ: ${contract.contractNo})`,
            quantity: 1,
            unitAmount: depositTopUp,
            amount: depositTopUp,
          }),
        );
        request.topupInvoiceId = invoice.id;
        await this.notifications.createForUsers(manager, [contract.customerId], {
          type: NotificationType.INVOICE_ISSUED,
          title: 'Hóa đơn thu bù tiền cọc',
          body:
            `Yêu cầu đổi sang kho ${target.code} đã được duyệt. Tiền cọc tăng thêm ` +
            `${depositTopUp.toLocaleString('vi-VN')} VND — vui lòng thanh toán hóa đơn ${invoice.invoiceNo}.`,
          data: { invoiceId: invoice.id, invoiceNo: invoice.invoiceNo, contractId: contract.id },
        });
      }

      request.status = ChangeRequestStatus.APPROVED;
      request.moveAt = moveAt;
      request.approvedBy = actor.id;
      request.decisionNote = dto.decisionNote;
      request.history = [
        ...(request.history ?? []),
        this.historyEntry(
          'STATUS_CHANGED',
          ChangeRequestStatus.REQUESTED,
          ChangeRequestStatus.APPROVED,
          actor.id,
          // The approver may adjust the day — the customer's proposal lives on in the
          // REQUESTED entry, so both stay recoverable.
          { moveAt: moveAt.toISOString() },
        ),
      ];
      await manager.save(request);
      await this.notifications.createForUsers(manager, [contract.customerId], {
        type: NotificationType.UNIT_CHANGE_APPROVED,
        title: 'Yêu cầu đổi kho được duyệt',
        body:
          `Yêu cầu đổi sang kho ${target.code} đã được duyệt — ngày chuyển ` +
          `${vietnamDate(moveAt).split('-').reverse().join('/')}.`,
        data: {
          requestId: request.id,
          contractId: contract.id,
          newUnitId: request.newUnitId,
          moveAt: moveAt.toISOString(),
        },
      });
      // The destination facility owns the held unit and receives the move — tell it too.
      await this.notifyFacilityManagers(manager, request.newUnit!.facilityId, {
        type: NotificationType.UNIT_CHANGE_APPROVED,
        title: 'Kho sắp nhận khách chuyển đến',
        body:
          `Kho ${target.code} đang được giữ chỗ — khách dự kiến chuyển từ kho ` +
          `${request.oldUnit?.code ?? 'khác'} vào ` +
          `${vietnamDate(moveAt).split('-').reverse().join('/')}.`,
        data: {
          requestId: request.id,
          contractId: contract.id,
          newUnitId: request.newUnitId,
          moveAt: moveAt.toISOString(),
        },
      });
    });

    return { request: toChangeRequestRecord(await this.findOrFail(id)) };
  }

  /**
   * The physical move starts — from the daily move-day sweep or early by a manager. Only a
   * marker: the swap itself is `complete`.
   */
  async start(id: string, actor: AuthUser): Promise<ChangeRequestResponse> {
    const request = await this.findOrFail(id);
    // Either end may kick the move off — the branch being left or the branch receiving it.
    await this.assertManagesEitherFacility(actor, request);

    await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(UnitChangeRequest, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (locked?.status !== ChangeRequestStatus.APPROVED) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          `Request cannot start moving while its status is ${locked?.status ?? 'unknown'}`,
          HttpStatus.CONFLICT,
        );
      }
      await this.assertContractStillMovable(manager, locked.contractId, locked.oldUnitId);
      locked.status = ChangeRequestStatus.TRANSITIONING;
      locked.transitionStartAt = new Date();
      locked.history = [
        ...(locked.history ?? []),
        this.historyEntry(
          'STATUS_CHANGED',
          ChangeRequestStatus.APPROVED,
          ChangeRequestStatus.TRANSITIONING,
          actor.id,
        ),
      ];
      await manager.save(locked);
      await this.notifyBothFacilities(manager, request, {
        type: NotificationType.UNIT_CHANGE_MOVE_TODAY,
        title: 'Khách bắt đầu chuyển kho',
        body:
          `Yêu cầu đổi từ kho ${request.oldUnit?.code ?? ''} sang kho ` +
          `${request.newUnit?.code ?? ''} đang được thực hiện — xác nhận khi khách chuyển xong.`,
        data: { requestId: locked.id, contractId: locked.contractId },
      });
    });

    return { request: toChangeRequestRecord(await this.findOrFail(id)) };
  }

  /**
   * The move is done: repoint the contract to the held unit (HELD → RENTED), retire the old
   * unit to MAINTENANCE until staff confirm it empty, and close the request COMPLETED.
   */
  async complete(id: string, actor: AuthUser): Promise<ChangeRequestResponse> {
    const request = await this.findOrFail(id);
    // The receiving branch confirms the goods arrived just as well as the sending one.
    await this.assertManagesEitherFacility(actor, request);

    if (!MOVE_IN_FLIGHT.includes(request.status)) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        `Request cannot be completed while its status is ${request.status}`,
        HttpStatus.CONFLICT,
      );
    }
    if (!request.newUnitId || !request.newUnit) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        'Request has no target unit to move into',
        HttpStatus.CONFLICT,
      );
    }
    if (request.newUnit.kind !== request.oldUnit.kind) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        'New unit must be the same kind as the current one',
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

    await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(UnitChangeRequest, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || !MOVE_IN_FLIGHT.includes(locked.status)) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          `Request cannot be completed while its status is ${locked?.status ?? 'unknown'}`,
          HttpStatus.CONFLICT,
        );
      }
      await this.assertContractStillMovable(manager, contract.id, request.oldUnitId);
      if (request.newUnit!.kind !== StorageUnitKind.SHELF) {
        await assertShelfEmpty(manager, contract.id, 'UNIT_CHANGE');
        await cancelOpenPickupRequests(manager, contract.id);
      }

      const targetFacility = await manager.findOne(Facility, {
        where: { id: request.newUnit!.facilityId },
        lock: { mode: 'pessimistic_read' },
      });
      if (!targetFacility || targetFacility.status !== FacilityStatus.ACTIVE) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Target unit facility is not active',
          HttpStatus.CONFLICT,
        );
      }
      await lockShelfParents(manager, [request.newUnit!]);

      // The unit was held at approval; if it was released or moved underneath us, bail out.
      const claimed = await manager
        .createQueryBuilder()
        .update(StorageUnit)
        .set({ status: StorageUnitStatus.RENTED })
        .where(`id = :id AND status = :held AND deleted_at IS NULL`, {
          id: request.newUnitId,
          held: StorageUnitStatus.HELD,
        })
        .execute();
      if (!claimed.affected) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Target unit is no longer held for this move',
          HttpStatus.CONFLICT,
        );
      }

      // Read after the claim: the claim row-locks the unit, so the price cannot change underneath.
      const target = await manager.findOneByOrFail(StorageUnit, { id: request.newUnitId });
      const newPrice = Number(target.monthlyPrice);
      const newDeposit = newPrice * (await this.settings.getDepositMonthsFor(target));

      // A HELD unit's price stays editable; if it moved since approval the billed top-up no
      // longer matches the deposit the swap would write — stop and let a human re-quote.
      const item = await manager.findOne(BookingItem, { where: { id: contract.bookingItemId } });
      const rentDifference = newPrice - Number(item?.monthlyPriceSnapshot ?? 0);
      const depositDifference = newDeposit - Number(item?.depositSnapshot ?? 0);
      if (
        rentDifference !== Number(request.rentDifference ?? 0) ||
        depositDifference !== Number(request.depositDifference ?? 0)
      ) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Target unit pricing changed since approval — cancel and resubmit',
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

      locked.status = ChangeRequestStatus.COMPLETED;
      locked.transitionEndAt = new Date();
      locked.history = [
        ...(locked.history ?? []),
        this.historyEntry(
          'STATUS_CHANGED',
          ChangeRequestStatus.TRANSITIONING,
          ChangeRequestStatus.COMPLETED,
          actor.id,
        ),
      ];
      await manager.save(locked);
      await this.notifications.createForUsers(manager, [contract.customerId], {
        type: NotificationType.UNIT_CHANGE_COMPLETED,
        title: 'Đã chuyển kho thành công',
        body: `Hợp đồng ${contract.contractNo} đã chuyển sang kho ${target.code}.`,
        data: {
          requestId: locked.id,
          contractId: contract.id,
          newUnitId: request.newUnitId,
        },
      });
      await this.notifyBothFacilities(manager, request, {
        type: NotificationType.UNIT_CHANGE_COMPLETED,
        title: 'Đã hoàn tất chuyển kho',
        body: `Khách đã chuyển từ kho ${request.oldUnit?.code ?? ''} sang kho ${target.code}.`,
        data: {
          requestId: locked.id,
          contractId: contract.id,
          newUnitId: request.newUnitId,
        },
      });
    });

    return { request: toChangeRequestRecord(await this.findOrFail(id)) };
  }

  /**
   * Withdraws a request. Customers withdraw their own while it is still REQUESTED; managers of
   * the facility being left can cancel anything in flight, releasing the held unit and voiding
   * the deposit top-up when it was never paid.
   */
  async cancel(id: string, actor: AuthUser): Promise<ChangeRequestResponse> {
    const request = await this.findOrFail(id);
    const isStaff = actor.roles.some(
      (role) => role === UserRole.ADMIN || role === UserRole.FACILITY_MANAGER,
    );
    if (isStaff) {
      // Either end may call it off — the held unit lives at the destination facility.
      await this.assertManagesEitherFacility(actor, request);
    } else if (request.requestedBy !== actor.id) {
      notFound('Change request');
    }
    const isOwner = !isStaff;
    const cancellable = isOwner ? CUSTOMER_CANCELLABLE : MANAGER_CANCELLABLE;
    if (!cancellable.includes(request.status)) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        `Request cannot be cancelled while its status is ${request.status}`,
        HttpStatus.CONFLICT,
      );
    }

    const now = new Date();
    await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(UnitChangeRequest, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || !cancellable.includes(locked.status)) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          `Request cannot be cancelled while its status is ${locked?.status ?? 'unknown'}`,
          HttpStatus.CONFLICT,
        );
      }

      if (MOVE_IN_FLIGHT.includes(locked.status)) {
        // The move was booked: give the target back and void the top-up it billed. Paid
        // money stays in the deposit for the end-of-contract settlement.
        await releaseMoveHold(manager, locked);
        locked.transitionEndAt = now;
      }

      const from = locked.status;
      locked.status = ChangeRequestStatus.CANCELLED;
      locked.history = [
        ...(locked.history ?? []),
        this.historyEntry('STATUS_CHANGED', from, ChangeRequestStatus.CANCELLED, actor.id),
      ];
      await manager.save(locked);

      if (isOwner) {
        await this.notifyBothFacilities(manager, request, {
          type: NotificationType.UNIT_CHANGE_CANCELLED,
          title: 'Khách huỷ yêu cầu đổi kho',
          body: `Yêu cầu đổi từ kho ${request.oldUnit?.code ?? ''} đã bị khách huỷ.`,
          data: { requestId: locked.id, contractId: locked.contractId },
        });
      } else {
        await this.notifications.createForUsers(manager, [locked.requestedBy], {
          type: NotificationType.UNIT_CHANGE_CANCELLED,
          title: 'Yêu cầu đổi kho đã bị huỷ',
          body:
            `Yêu cầu đổi sang kho ${request.newUnit?.code ?? ''} đã bị chi nhánh huỷ` +
            ` — liên hệ chi nhánh nếu cần hỗ trợ.`,
          data: { requestId: locked.id, contractId: locked.contractId },
        });
      }
    });

    return { request: toChangeRequestRecord(await this.findOrFail(id)) };
  }

  /**
   * The status check in `decide` runs before any lock, so two managers deciding at once both
   * pass it. Re-checking under the request row lock lets only the first decision commit.
   */
  private async lockUndecidedRequest(manager: EntityManager, id: string): Promise<void> {
    const current = await manager.findOne(UnitChangeRequest, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (current?.status !== ChangeRequestStatus.REQUESTED) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        `Request cannot be decided while its status is ${current?.status ?? 'unknown'}`,
        HttpStatus.CONFLICT,
      );
    }
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

  /** Managers currently assigned to one facility. */
  private async notifyFacilityManagers(
    manager: EntityManager,
    facilityId: string,
    payload: { type: NotificationType; title: string; body: string; data: Record<string, unknown> },
  ): Promise<void> {
    const userIds = await this.loadFacilityManagerUserIds(manager, facilityId);
    if (userIds.length === 0) return;
    await this.notifications.createForUsers(manager, userIds, payload);
  }

  /** Managers on both ends of the move — deduped when the request stays in one facility. */
  private async notifyBothFacilities(
    manager: EntityManager,
    request: UnitChangeRequest,
    payload: { type: NotificationType; title: string; body: string; data: Record<string, unknown> },
  ): Promise<void> {
    const facilityIds = new Set([request.oldUnit?.facilityId, request.newUnit?.facilityId]);
    const userIds = new Set<string>();
    for (const facilityId of facilityIds) {
      if (!facilityId) continue;
      for (const userId of await this.loadFacilityManagerUserIds(manager, facilityId)) {
        userIds.add(userId);
      }
    }
    if (userIds.size === 0) return;
    await this.notifications.createForUsers(manager, [...userIds], payload);
  }

  private async loadFacilityManagerUserIds(
    manager: EntityManager,
    facilityId: string,
  ): Promise<string[]> {
    const assignments = await manager.find(UserRoleAssignment, {
      where: { role: UserRole.FACILITY_MANAGER, facilityId },
    });
    return [...new Set(assignments.filter((a) => isAssignmentActive(a)).map((a) => a.userId))];
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
        { facilityId },
      );
    }
  }

  /** Cross-facility moves: managing either the source or the destination facility counts. */
  private async assertManagesEitherFacility(
    actor: AuthUser,
    request: UnitChangeRequest,
  ): Promise<void> {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return;
    }
    const managedFacilityIds = await this.loadManagedFacilityIds(actor.id);
    const involved = [request.oldUnit?.facilityId, request.newUnit?.facilityId];
    if (!involved.some((facilityId) => facilityId && managedFacilityIds.includes(facilityId))) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not manage a facility this request belongs to',
        HttpStatus.FORBIDDEN,
        { facilityIds: involved },
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
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return { action, from, to, at: new Date().toISOString(), by, ...extra };
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

/** 400 unless `at` falls on a Vietnam day from today to MOVE_MAX_DAYS_AHEAD days ahead. */
export function assertMoveDayInRange(field: string, at: Date, now: Date = new Date()): void {
  const day = vietnamDate(at);
  const today = vietnamToday(now);
  if (day < today || day > addVietnamDays(today, MOVE_MAX_DAYS_AHEAD)) {
    throw new DomainException(
      ErrorCode.VALIDATION_FAILED,
      'Validation failed',
      HttpStatus.BAD_REQUEST,
      {
        fields: [
          {
            field,
            code: 'outOfRange',
            message: `Chọn ngày chuyển trong khoảng từ hôm nay đến ${MOVE_MAX_DAYS_AHEAD} ngày tới`,
          },
        ],
      },
    );
  }
}
