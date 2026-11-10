import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { isAssignmentActive } from '@modules/auth/role-assignment.util';
import { NotificationsService } from '@modules/notifications/notifications.service';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import { SettingsService } from '@modules/settings/settings.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { vietnamDate, vietnamDayIndex } from '@shared/utils/calendar.util';
import { ContractStatus, NotificationType, UserRole } from '@storage/types';
import { DataSource } from 'typeorm';

const LOCK_NAME = 'cron_no_show_suggestions';

interface NoShowRow {
  contractId: string;
  contractNo: string;
  customerId: string;
  facilityId: string;
  facilityName: string;
  unitCode: string;
  effectiveAt: Date;
}

/**
 * Nudges facility managers about DRAFT contracts whose contracted start (the booked handover
 * day) passed without the customer showing up: the unit stays BOOKED and any money taken sits
 * unrefunded until somebody acts. The threshold is `contract.no_show_after_days`; the
 * notification suggests calling the customer and cancelling the contract — nothing is changed
 * automatically.
 */
@Injectable()
export class NoShowSuggestionService {
  private readonly logger = new Logger(NoShowSuggestionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('45 8 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handle(): Promise<void> {
    try {
      const sent = await this.run(new Date());
      this.logger.log(`No-show suggestions: ${sent} contract(s) flagged`);
    } catch (err: any) {
      this.logger.error(`Failed in no-show-suggestion run: ${err?.message || err}`, err?.stack);
    }
  }

  async run(now: Date): Promise<number> {
    return this.dataSource.transaction(async (em) => {
      const lock = (await em.query(`SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired`, [
        LOCK_NAME,
      ])) as Array<{ acquired: boolean }>;
      if (!lock?.[0]?.acquired) {
        this.logger.debug('No-show suggestions: another instance is running, skipping');
        return 0;
      }

      const threshold = await this.settings.getNoShowAfterDays();
      const todayIndex = vietnamDayIndex(now);

      const rows = (await em.query(
        `SELECT c.id AS "contractId", c.contract_no AS "contractNo", c.customer_id AS "customerId",
                f.id AS "facilityId", f.name AS "facilityName",
                su.code AS "unitCode", c.effective_at AS "effectiveAt"
           FROM contracts c
           JOIN booking_items bi ON bi.id = c.booking_item_id
           JOIN storage_units su ON su.id = bi.storage_unit_id
           JOIN facilities f ON f.id = su.facility_id
          WHERE c.status = $1 AND c.deleted_at IS NULL`,
        [ContractStatus.DRAFT],
      )) as NoShowRow[];

      // Still DRAFT this many days after the contracted start = the handover never happened.
      const candidates = rows
        .map((row) => ({
          ...row,
          overdueDays: todayIndex - vietnamDayIndex(vietnamDate(new Date(row.effectiveAt))),
        }))
        .filter((row) => row.overdueDays > threshold);
      if (candidates.length === 0) return 0;

      // One suggestion per contract, ever — the notification row is the record it was sent.
      const alreadySent = new Set(
        (
          (await em.query(
            `SELECT DISTINCT data->>'contractId' AS "contractId" FROM notifications
              WHERE type = $1 AND (data->>'contractId')::uuid = ANY($2::uuid[])`,
            [NotificationType.CONTRACT_NO_SHOW, candidates.map((c) => c.contractId)],
          )) as Array<{ contractId: string }>
        ).map((r) => r.contractId),
      );

      let sent = 0;
      for (const candidate of candidates) {
        if (alreadySent.has(candidate.contractId)) continue;
        const assignments = await em.find(UserRoleAssignment, {
          where: { facilityId: candidate.facilityId, role: UserRole.FACILITY_MANAGER },
        });
        const managerIds = assignments.filter((a) => isAssignmentActive(a)).map((a) => a.userId);
        if (managerIds.length === 0) continue;
        await this.notifications.createForUsers(em, managerIds, noShowNotification(candidate));
        sent += 1;
      }
      return sent;
    });
  }
}

function noShowNotification(candidate: NoShowRow & { overdueDays: number }): NotificationPayload {
  return {
    type: NotificationType.CONTRACT_NO_SHOW,
    title: 'Khách không đến nhận kho',
    body:
      `Hợp đồng ${candidate.contractNo} (kho ${candidate.unitCode}, ${candidate.facilityName}) ` +
      `đã quá ngày bàn giao ${candidate.overdueDays} ngày mà khách chưa đến nhận. ` +
      `Liên hệ khách; nếu hủy, hệ thống sẽ xếp số tiền đã thu vào hàng đợi hoàn tiền.`,
    data: {
      contractId: candidate.contractId,
      contractNo: candidate.contractNo,
      unitCode: candidate.unitCode,
      facilityId: candidate.facilityId,
      overdueDays: candidate.overdueDays,
    },
  };
}
