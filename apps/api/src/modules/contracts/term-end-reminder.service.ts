import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { isAssignmentActive } from '@modules/auth/role-assignment.util';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { SettingsService } from '@modules/settings/settings.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  ContractStatus,
  InspectionType,
  NotificationType,
  type ReturnRules,
  UserRole,
} from '@storage/types';
import { DataSource, type EntityManager, In } from 'typeorm';
import { currentReturnRules } from './contract-return.util';
import {
  managerOverdueNotification,
  planTermEndReminder,
  TERM_END_TYPES,
  type TermEndCandidate,
} from './term-end-notifications';

export interface TermEndReminderResult {
  ending: number;
  overdue: number;
}

interface CandidateRow {
  contractId: string;
  contractNo: string;
  customerId: string;
  unitCode: string;
  facilityId: string;
  effectiveAt: Date;
  months: number;
  monthlyPrice: string;
  hasOpenReturn: boolean;
  returnScheduledAt: Date | null;
  returnRules: ReturnRules | null;
}

const LOCK_NAME = 'cron_term_end_reminders';

/**
 * Tells customers, once each, that their contract term is about to end and later that it has.
 * Customers only; no invoice, no renewal. A reminder is stored once per contract and kind: the
 * notifications already stored are the record of what was sent, and the run holds a transaction
 * advisory lock so concurrent instances cannot both send.
 */
@Injectable()
export class TermEndReminderService {
  private readonly logger = new Logger(TermEndReminderService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 8 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handle(): Promise<void> {
    try {
      const sent = await this.run(new Date());
      this.logger.log(`Term-end reminders: ${sent.ending} ending, ${sent.overdue} overdue`);
    } catch (err: any) {
      this.logger.error(`Failed in term-end reminder run: ${err?.message || err}`, err?.stack);
    }
  }

  async run(now: Date): Promise<TermEndReminderResult> {
    return this.dataSource.transaction(async (em) => {
      const lock = (await em.query(`SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired`, [
        LOCK_NAME,
      ])) as Array<{ acquired: boolean }>;
      const result: TermEndReminderResult = { ending: 0, overdue: 0 };
      if (!lock?.[0]?.acquired) {
        this.logger.debug('Term-end reminders: another instance is running, skipping');
        return result;
      }

      const [currentRules, goLiveAt, candidates] = await Promise.all([
        currentReturnRules(this.settings),
        this.settings.getReturnRulesEffectiveAt(),
        this.loadCandidates(em),
      ]);
      const due = candidates.flatMap((candidate) => {
        const payload = planTermEndReminder(candidate, { now, currentRules, goLiveAt });
        return payload ? [{ candidate, payload }] : [];
      });
      // An overdue contract also tells its branch's managers — day one, not after the abandoned
      // threshold — so someone can reach the customer while it is still early.
      const overdueFacilityIds = [
        ...new Set(
          due
            .filter((d) => d.payload.type === NotificationType.CONTRACT_OVERDUE)
            .map((d) => d.candidate.facilityId),
        ),
      ];
      const managerIdsByFacility = await this.loadManagerIds(em, overdueFacilityIds);
      const sends = due.flatMap(({ candidate, payload }) => {
        const recipients = [{ userId: candidate.customerId, payload }];
        if (payload.type === NotificationType.CONTRACT_OVERDUE) {
          for (const managerId of managerIdsByFacility.get(candidate.facilityId) ?? []) {
            recipients.push({
              userId: managerId,
              payload: managerOverdueNotification(candidate),
            });
          }
        }
        return recipients;
      });
      const alreadySent = await this.loadSentKeys(em, [...new Set(sends.map((s) => s.userId))]);

      for (const { userId, payload } of sends) {
        const key = sentKey(userId, payload.type, String(payload.data?.contractId));
        if (alreadySent.has(key)) continue;
        await this.notifications.createForUsers(em, [userId], payload);
        if (payload.type === NotificationType.CONTRACT_OVERDUE) result.overdue += 1;
        else result.ending += 1;
      }
      return result;
    });
  }

  /** Active, live contracts with the customer's open return request, if any. */
  private async loadCandidates(em: EntityManager): Promise<TermEndCandidate[]> {
    const rows = (await em.query(
      `SELECT c.id AS "contractId", c.contract_no AS "contractNo", c.customer_id AS "customerId",
              su.code AS "unitCode", su.facility_id AS "facilityId",
              c.effective_at AS "effectiveAt", c.months,
              c.monthly_price_snapshot AS "monthlyPrice", (r.id IS NOT NULL) AS "hasOpenReturn",
              r.scheduled_at AS "returnScheduledAt", r.return_rules AS "returnRules"
         FROM contracts c
         JOIN booking_items bi ON bi.id = c.booking_item_id
         JOIN storage_units su ON su.id = bi.storage_unit_id
         LEFT JOIN LATERAL (
              SELECT i.id, i.scheduled_at, i.return_rules
                FROM inspections i
               WHERE i.contract_id = c.id AND i.type = $2 AND i.finalized_at IS NULL
               ORDER BY i.created_at DESC
               LIMIT 1) r ON TRUE
        WHERE c.status = $1 AND c.deleted_at IS NULL`,
      [ContractStatus.ACTIVE, InspectionType.RETURN],
    )) as CandidateRow[];
    return rows.map((row) => ({
      contractId: row.contractId,
      contractNo: row.contractNo,
      customerId: row.customerId,
      unitCode: row.unitCode,
      facilityId: row.facilityId,
      effectiveAt: new Date(row.effectiveAt),
      months: Number(row.months),
      monthlyPrice: String(row.monthlyPrice),
      openReturn: row.hasOpenReturn
        ? {
            scheduledAt: row.returnScheduledAt ? new Date(row.returnScheduledAt) : null,
            rules: row.returnRules,
          }
        : null,
    }));
  }

  /** Active FACILITY_MANAGER user ids grouped by facility, for the overdue escalation. */
  private async loadManagerIds(
    em: EntityManager,
    facilityIds: string[],
  ): Promise<Map<string, string[]>> {
    const byFacility = new Map<string, string[]>();
    if (facilityIds.length === 0) return byFacility;
    const assignments = await em.find(UserRoleAssignment, {
      where: { role: UserRole.FACILITY_MANAGER, facilityId: In(facilityIds) },
    });
    for (const a of assignments) {
      if (!a.facilityId || !isAssignmentActive(a)) continue;
      const list = byFacility.get(a.facilityId) ?? [];
      if (!list.includes(a.userId)) list.push(a.userId);
      byFacility.set(a.facilityId, list);
    }
    return byFacility;
  }

  private async loadSentKeys(em: EntityManager, customerIds: string[]): Promise<Set<string>> {
    if (customerIds.length === 0) return new Set();
    const rows = (await em.query(
      `SELECT user_id AS "userId", type, data->>'contractId' AS "contractId"
         FROM notifications
        WHERE user_id = ANY($1::uuid[]) AND type = ANY($2::text[])`,
      [customerIds, [...TERM_END_TYPES]],
    )) as Array<{ userId: string; type: string; contractId: string | null }>;
    return new Set(rows.map((r) => sentKey(r.userId, r.type, String(r.contractId))));
  }
}

const sentKey = (customerId: string, type: string, contractId: string): string =>
  `${customerId}|${type}|${contractId}`;
