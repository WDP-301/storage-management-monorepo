import { Contract } from '@entities/contract.entity';
import { Invoice } from '@entities/invoice.entity';
import { UnitChangeRequest } from '@entities/unit-change-request.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { isAssignmentActive } from '@modules/auth/role-assignment.util';
import { HandoverAssignmentService } from '@modules/inspection/handover-assignment/handover-assignment.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { vietnamDate, vietnamToday } from '@shared/utils/calendar.util';
import {
  ChangeRequestStatus,
  ContractStatus,
  InvoiceStatus,
  NotificationType,
  UserRole,
} from '@storage/types';
import { DataSource, type EntityManager, In } from 'typeorm';
import { releaseMoveHold } from './change-request-release.util';
import {
  destinationStillRunnable,
  type SettleDeps,
  settleIfTopUpInvoicePaid,
  unwindSettledChangeRequest,
} from './change-request-settle.util';

const LOCK_NAME = 'cron_unit_change_move_day';
/** How long a move may sit unattended before the sweep cancels it, in days. */
const MOVE_OVERDUE_DAYS = 7;
/** The sweep's actor recorded in history entries. */
const SYSTEM_ACTOR = 'system';

export interface MoveDaySweepResult {
  started: number;
  reminded: number;
  cancelled: number;
}

/**
 * The move-day sweep, now spanning the two-approval flow. Each request is handled in its own
 * transaction under its own row lock, so a concurrent decide/final-approve/cancel — or one bad
 * row — can never corrupt or stall the run:
 *
 * - REQUESTED whose proposed move day already passed → auto-cancelled (nobody ever decided).
 * - AWAITING_PAYMENT: a paid top-up whose settle failed is retried (self-heal); past the move day
 *   the managers are reminded, and past MOVE_OVERDUE_DAYS the request is auto-cancelled (hold
 *   released, unpaid invoice voided).
 * - AWAITING_HANDOVER: a destination that is no longer runnable is auto-cancelled (unwound); past
 *   the move day both facilities are reminded daily.
 * - AWAITING_FINAL_APPROVAL: the destination branch is reminded daily to give the final approval;
 *   a destination contract that fell over auto-cancels the request.
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
    private readonly handoverAssignment: HandoverAssignmentService,
  ) {}

  private settleDeps(): SettleDeps {
    return { handoverAssignment: this.handoverAssignment, notifications: this.notifications };
  }

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
            ChangeRequestStatus.AWAITING_PAYMENT,
            ChangeRequestStatus.AWAITING_HANDOVER,
            ChangeRequestStatus.AWAITING_FINAL_APPROVAL,
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

    if (request.status === ChangeRequestStatus.AWAITING_PAYMENT) {
      // A paid top-up whose settle failed is retried every run.
      if (request.topupInvoiceId) {
        const invoice = await em.findOne(Invoice, { where: { id: request.topupInvoiceId } });
        if (invoice?.status === InvoiceStatus.PAID) {
          await settleIfTopUpInvoicePaid(em, invoice, this.settleDeps(), null);
          const refreshed = await em.findOne(UnitChangeRequest, { where: { id } });
          if (refreshed && refreshed.status !== ChangeRequestStatus.AWAITING_PAYMENT) {
            return 'started';
          }
        }
      }
      if (!request.moveAt || vietnamDate(request.moveAt) >= today) return null;
      const overdueAfter = vietnamDate(new Date(now.getTime() - MOVE_OVERDUE_DAYS * 86400_000));
      if (vietnamDate(request.moveAt) < overdueAfter) {
        await this.autoCancel(em, request, now, 'Quá hạn ngày chuyển mà chưa thanh toán bù cọc');
        return 'cancelled';
      }
      await this.notifyManagers(
        em,
        request,
        'Yêu cầu đổi kho chờ thanh toán bù cọc',
        request.moveAt,
        'Khách chưa thanh toán bù cọc — nhắc khách hoặc thu hồi yêu cầu.',
      );
      return 'reminded';
    }

    if (request.status === ChangeRequestStatus.AWAITING_HANDOVER) {
      if (!(await destinationStillRunnable(em, request))) {
        await unwindSettledChangeRequest(em, request);
        await this.recordCancelled(
          em,
          request,
          now,
          'Kho đích không còn sẵn sàng cho việc chuyển kho',
        );
        return 'cancelled';
      }
      if (!request.moveAt || vietnamDate(request.moveAt) > today) return null;
      await this.notifyManagers(
        em,
        request,
        'Đến ngày bàn giao kho mới',
        request.moveAt,
        'Khách bàn giao kho mới hôm nay — xác nhận khi hoàn tất.',
      );
      return 'reminded';
    }

    if (request.status === ChangeRequestStatus.AWAITING_FINAL_APPROVAL) {
      const newContract = request.newContractId
        ? await em.findOne(Contract, { where: { id: request.newContractId } })
        : null;
      if (
        !newContract ||
        newContract.status === ContractStatus.CANCELLED ||
        newContract.status === ContractStatus.ENDED
      ) {
        await this.recordCancelled(em, request, now, 'Hợp đồng mới không còn hiệu lực');
        return 'cancelled';
      }
      await this.notifyManagers(
        em,
        request,
        'Chờ chốt hoàn tất đổi kho',
        request.moveAt ?? now,
        'Khách đã bàn giao kho mới — xác nhận hoàn tất để khép lại yêu cầu.',
      );
      return 'reminded';
    }
    return null;
  }

  private async autoCancel(
    em: EntityManager,
    request: UnitChangeRequest,
    now: Date,
    reason: string,
  ): Promise<void> {
    if (request.status === ChangeRequestStatus.AWAITING_PAYMENT) {
      await releaseMoveHold(em, request);
    }
    await this.recordCancelled(em, request, now, reason);
  }

  /** Flips the request to CANCELLED with a history entry and tells the customer. */
  private async recordCancelled(
    em: EntityManager,
    request: UnitChangeRequest,
    now: Date,
    reason: string,
  ): Promise<void> {
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
