import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { UnitChangeRequest } from '@entities/unit-change-request.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { isAssignmentActive } from '@modules/auth/role-assignment.util';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { vietnamDate, vietnamToday } from '@shared/utils/calendar.util';
import { ChangeRequestStatus, ContractStatus, NotificationType, UserRole } from '@storage/types';
import { DataSource, type EntityManager, In } from 'typeorm';
import { releaseMoveHold } from './change-request-release.util';

const LOCK_NAME = 'cron_unit_change_move_day';
/** A TRANSITIONING move unconfirmed for this long pings the facility managers daily. */
const MOVE_OVERDUE_DAYS = 7;
/** The sweep's actor recorded in history entries. */
const SYSTEM_ACTOR = 'system';

export interface MoveDaySweepResult {
  started: number;
  reminded: number;
  cancelled: number;
}

/**
 * The move-day sweep. Each request is handled in its own transaction under its own row lock,
 * so a concurrent decide/complete/cancel — or one bad row — can never corrupt or stall the run:
 *
 * - APPROVED whose move day arrived → TRANSITIONING, but only while the contract is still
 *   alive and still on the source unit; a dead move is auto-cancelled with its hold released.
 * - TRANSITIONING stuck past MOVE_OVERDUE_DAYS → daily reminder to managers of both facilities;
 *   a dead contract's stuck move is auto-cancelled the same way.
 * - REQUESTED whose proposed move day already passed → auto-cancelled (nobody ever decided).
 *
 * A session-level advisory lock (not xact — the run spans many transactions) keeps concurrent
 * instances from double-sending; the row locks make each request's branch idempotent anyway.
 */
@Injectable()
export class MoveDaySweepService {
  private readonly logger = new Logger(MoveDaySweepService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('15 7 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handle(): Promise<void> {
    try {
      const result = await this.run(new Date());
      this.logger.log(
        `Unit-change move-day sweep: ${result.started} started, ` +
          `${result.reminded} reminded, ${result.cancelled} cancelled`,
      );
    } catch (err: any) {
      this.logger.error(`Failed in unit-change move-day sweep: ${err?.message || err}`, err?.stack);
    }
  }

  async run(now: Date): Promise<MoveDaySweepResult> {
    const result: MoveDaySweepResult = { started: 0, reminded: 0, cancelled: 0 };
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      const lock = (await runner.query(`SELECT pg_try_advisory_lock(hashtext($1)) AS acquired`, [
        LOCK_NAME,
      ])) as Array<{ acquired: boolean }>;
      if (!lock?.[0]?.acquired) return result;

      const candidates = await runner.manager.find(UnitChangeRequest, {
        where: {
          status: In([
            ChangeRequestStatus.REQUESTED,
            ChangeRequestStatus.APPROVED,
            ChangeRequestStatus.TRANSITIONING,
          ]),
        },
        relations: { oldUnit: true, newUnit: true },
      });

      const today = vietnamToday(now);
      for (const candidate of candidates) {
        try {
          const outcome = await this.dataSource.transaction((em) =>
            this.handleOne(em, candidate.id, today, now),
          );
          if (outcome === 'started') result.started += 1;
          else if (outcome === 'reminded') result.reminded += 1;
          else if (outcome === 'cancelled') result.cancelled += 1;
        } catch (err: any) {
          this.logger.error(
            `Move-day sweep failed for request ${candidate.id}: ${err?.message || err}`,
            err?.stack,
          );
        }
      }
      return result;
    } finally {
      try {
        await runner.query(`SELECT pg_advisory_unlock(hashtext($1))`, [LOCK_NAME]);
      } finally {
        await runner.release();
      }
    }
  }

  /** One request under its row lock; returns what the sweep did to it, or null. */
  private async handleOne(
    em: EntityManager,
    id: string,
    today: string,
    now: Date,
  ): Promise<'started' | 'reminded' | 'cancelled' | null> {
    const request = await em.findOne(UnitChangeRequest, {
      where: { id },
      relations: { oldUnit: true, newUnit: true },
      lock: { mode: 'pessimistic_write' },
    });
    if (!request) return null;

    if (request.status === ChangeRequestStatus.REQUESTED) {
      // Nobody ever decided — once the proposed day is gone the request is dead weight.
      if (!request.moveAt || vietnamDate(request.moveAt) >= today) return null;
      await this.autoCancel(em, request, now, 'Quá ngày chuyển đề xuất mà chưa được duyệt');
      return 'cancelled';
    }

    if (request.status === ChangeRequestStatus.APPROVED) {
      if (!request.moveAt || vietnamDate(request.moveAt) > today) return null;
      if (!(await this.contractStillMovable(em, request))) {
        await this.autoCancel(em, request, now, 'Hợp đồng không còn ở trạng thái chuyển được');
        return 'cancelled';
      }
      request.status = ChangeRequestStatus.TRANSITIONING;
      request.transitionStartAt = now;
      request.history = [
        ...(request.history ?? []),
        {
          action: 'STATUS_CHANGED',
          from: ChangeRequestStatus.APPROVED,
          to: ChangeRequestStatus.TRANSITIONING,
          at: now.toISOString(),
          by: SYSTEM_ACTOR,
        },
      ];
      await em.save(request);
      await this.notifyManagers(em, request, 'Hôm nay khách chuyển kho', request.moveAt);
      return 'started';
    }

    if (request.status === ChangeRequestStatus.TRANSITIONING) {
      if (!(await this.contractStillMovable(em, request))) {
        await this.autoCancel(em, request, now, 'Hợp đồng không còn ở trạng thái chuyển được');
        return 'cancelled';
      }
      const startedAt = request.transitionStartAt ?? request.moveAt;
      if (!startedAt) return null;
      const overdueAfter = vietnamDate(new Date(now.getTime() - MOVE_OVERDUE_DAYS * 86400_000));
      if (vietnamDate(startedAt) >= overdueAfter) return null;
      await this.notifyManagers(
        em,
        request,
        'Chuyển kho quá hạn xác nhận',
        startedAt,
        `Chuyển kho từ ${vietnamDate(startedAt)} chưa được xác nhận — xác nhận hoặc thu hồi yêu cầu.`,
      );
      return 'reminded';
    }
    return null;
  }

  /**
   * The move's contract is still ACTIVE and still on the source unit — anything else means
   * the move can never complete and must be cancelled instead of left holding a unit.
   */
  private async contractStillMovable(
    em: EntityManager,
    request: UnitChangeRequest,
  ): Promise<boolean> {
    const contract = await em.findOne(Contract, {
      where: { id: request.contractId },
      lock: { mode: 'pessimistic_read' },
    });
    if (!contract || contract.status !== ContractStatus.ACTIVE) return false;
    const item = await em.findOne(BookingItem, { where: { id: contract.bookingItemId } });
    return item?.storageUnitId === request.oldUnitId;
  }

  private async autoCancel(
    em: EntityManager,
    request: UnitChangeRequest,
    now: Date,
    reason: string,
  ): Promise<void> {
    if (
      request.status === ChangeRequestStatus.APPROVED ||
      request.status === ChangeRequestStatus.TRANSITIONING
    ) {
      await releaseMoveHold(em, request);
      request.transitionEndAt = now;
    }
    const from = request.status;
    request.status = ChangeRequestStatus.CANCELLED;
    request.history = [
      ...(request.history ?? []),
      {
        action: 'STATUS_CHANGED',
        from,
        to: ChangeRequestStatus.CANCELLED,
        at: now.toISOString(),
        by: SYSTEM_ACTOR,
        reason,
      },
    ];
    await em.save(request);
    await this.notifications.createForUsers(em, [request.requestedBy], {
      type: NotificationType.UNIT_CHANGE_CANCELLED,
      title: 'Yêu cầu đổi kho đã bị huỷ',
      body: `Yêu cầu đổi sang kho ${request.newUnit?.code ?? ''} đã bị huỷ — ${reason}.`,
      data: { requestId: request.id, contractId: request.contractId },
    });
  }

  private async notifyManagers(
    em: EntityManager,
    request: UnitChangeRequest,
    title: string,
    moveDay: Date,
    extraLine?: string,
  ): Promise<void> {
    const facilityIds = new Set([request.oldUnit?.facilityId, request.newUnit?.facilityId]);
    const userIds = new Set<string>();
    for (const facilityId of facilityIds) {
      if (!facilityId) continue;
      const assignments = await em.find(UserRoleAssignment, {
        where: { role: UserRole.FACILITY_MANAGER, facilityId },
      });
      for (const a of assignments) {
        if (isAssignmentActive(a)) userIds.add(a.userId);
      }
    }
    if (userIds.size === 0) return;
    await this.notifications.createForUsers(em, [...userIds], {
      type: NotificationType.UNIT_CHANGE_MOVE_TODAY,
      title,
      body:
        `Đổi từ kho ${request.oldUnit?.code ?? ''} sang kho ${request.newUnit?.code ?? ''}` +
        ` — ngày chuyển ${vietnamDate(moveDay).split('-').reverse().join('/')}.` +
        (extraLine ? ` ${extraLine}` : ''),
      data: { requestId: request.id, contractId: request.contractId },
    });
  }
}
