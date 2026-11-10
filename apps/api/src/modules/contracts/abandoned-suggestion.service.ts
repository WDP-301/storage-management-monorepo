import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { isAssignmentActive } from '@modules/auth/role-assignment.util';
import { NotificationsService } from '@modules/notifications/notifications.service';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import { SettingsService } from '@modules/settings/settings.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { addVietnamMonths, vietnamDate, vietnamDayIndex } from '@shared/utils/calendar.util';
import { ContractStatus, InspectionType, NotificationType, UserRole } from '@storage/types';
import { DataSource } from 'typeorm';

const LOCK_NAME = 'cron_abandoned_suggestions';

interface OverdueRow {
  contractId: string;
  contractNo: string;
  customerId: string;
  facilityId: string;
  facilityName: string;
  unitCode: string;
  effectiveAt: Date;
  months: number;
}

/**
 * Nudges facility managers about contracts that stayed ACTIVE well past their term end without
 * the customer ever asking to return — the operational definition of "may be abandoned". The
 * threshold is `contract.abandoned_after_days`; the notification suggests opening an on-behalf
 * return (source ABANDONED) but nothing is changed automatically — taking the unit back is a
 * human, legal decision.
 */
@Injectable()
export class AbandonedSuggestionService {
  private readonly logger = new Logger(AbandonedSuggestionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('30 8 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handle(): Promise<void> {
    try {
      const sent = await this.run(new Date());
      this.logger.log(`Abandoned suggestions: ${sent} contract(s) flagged`);
    } catch (err: any) {
      this.logger.error(`Failed in abandoned-suggestion run: ${err?.message || err}`, err?.stack);
    }
  }

  async run(now: Date): Promise<number> {
    return this.dataSource.transaction(async (em) => {
      const lock = (await em.query(`SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired`, [
        LOCK_NAME,
      ])) as Array<{ acquired: boolean }>;
      if (!lock?.[0]?.acquired) {
        this.logger.debug('Abandoned suggestions: another instance is running, skipping');
        return 0;
      }

      const threshold = await this.settings.getAbandonedAfterDays();
      const todayIndex = vietnamDayIndex(now);

      const rows = (await em.query(
        `SELECT c.id AS "contractId", c.contract_no AS "contractNo", c.customer_id AS "customerId",
                f.id AS "facilityId", f.name AS "facilityName",
                su.code AS "unitCode", c.effective_at AS "effectiveAt", c.months
           FROM contracts c
           JOIN booking_items bi ON bi.id = c.booking_item_id
           JOIN storage_units su ON su.id = bi.storage_unit_id
           JOIN facilities f ON f.id = su.facility_id
          WHERE c.status = $1 AND c.deleted_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM inspections i
                             WHERE i.contract_id = c.id AND i.type = $2 AND i.finalized_at IS NULL)`,
        [ContractStatus.ACTIVE, InspectionType.RETURN],
      )) as OverdueRow[];

      // Past the term end AND past the threshold, counted in Vietnam days.
      const candidates = rows
        .map((row) => {
          const termEndDay = vietnamDate(
            addVietnamMonths(new Date(row.effectiveAt), Number(row.months)),
          );
          return { ...row, overdueDays: todayIndex - vietnamDayIndex(termEndDay) };
        })
        .filter((row) => row.overdueDays > threshold);
      if (candidates.length === 0) return 0;

      // One suggestion per contract, ever — the notification row is the record it was sent.
      const alreadySent = new Set(
        (
          (await em.query(
            `SELECT DISTINCT data->>'contractId' AS "contractId" FROM notifications
              WHERE type = $1 AND (data->>'contractId')::uuid = ANY($2::uuid[])`,
            [NotificationType.CONTRACT_MAY_BE_ABANDONED, candidates.map((c) => c.contractId)],
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
        await this.notifications.createForUsers(
          em,
          managerIds,
          abandonedSuggestionNotification(candidate),
        );
        sent += 1;
      }
      return sent;
    });
  }
}

function abandonedSuggestionNotification(
  candidate: OverdueRow & { overdueDays: number },
): NotificationPayload {
  return {
    type: NotificationType.CONTRACT_MAY_BE_ABANDONED,
    title: 'Kho có thể bị bỏ hoang',
    body:
      `Hợp đồng ${candidate.contractNo} (kho ${candidate.unitCode}, ${candidate.facilityName}) ` +
      `đã quá hạn ${candidate.overdueDays} ngày mà khách chưa yêu cầu trả kho. ` +
      `Xem xét mở thu hồi kho hộ khách (nguồn ABANDONED) sau khi liên hệ lần cuối.`,
    data: {
      contractId: candidate.contractId,
      contractNo: candidate.contractNo,
      unitCode: candidate.unitCode,
      facilityId: candidate.facilityId,
      overdueDays: candidate.overdueDays,
    },
  };
}
