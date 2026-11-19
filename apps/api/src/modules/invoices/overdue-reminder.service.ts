import { activeRoleHolderIds } from '@modules/auth/role-assignment.util';
import { NotificationsService } from '@modules/notifications/notifications.service';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { startOfVietnamDay } from '@shared/utils/calendar.util';
import {
  ContractStatus,
  InvoiceStatus,
  NotificationType,
  PaymentStatus,
  UserRole,
} from '@storage/types';
import Decimal from 'decimal.js';
import { DataSource, type EntityManager } from 'typeorm';
import {
  customerOverdueNotification,
  daysOverdue,
  isCustomerReminderDay,
  isManagerAlertDay,
  managerOverdueAlert,
  type OverdueInvoice,
} from './overdue-reminder.util';

const LOCK_NAME = 'cron_invoice_overdue_reminders';

export interface OverdueReminderResult {
  customer: number;
  manager: number;
}

interface OverdueRow {
  invoiceId: string;
  invoiceNo: string;
  customerId: string;
  customerName: string;
  contractId: string | null;
  contractNo: string | null;
  unitCode: string | null;
  facilityId: string | null;
  dueAt: Date;
  total: string;
  paid: string;
}

/**
 * Reminds customers of unpaid invoices past their due day (days 1, 3, 7, then weekly) and, from
 * a week overdue, tells the managers of the unit's branch so someone calls. Nothing is charged
 * or blocked here — overdue invoices already hold back new bookings, unit changes and shelf
 * counters. A reminder is sent at most once per invoice, recipient and overdue day, so a rerun
 * the same day sends nothing new; a day the job did not run is skipped, not caught up.
 */
@Injectable()
export class OverdueReminderService {
  private readonly logger = new Logger(OverdueReminderService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('10 8 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handle(): Promise<void> {
    try {
      const sent = await this.run(new Date());
      this.logger.log(`Overdue reminders: ${sent.customer} customer, ${sent.manager} manager`);
    } catch (err: any) {
      this.logger.error(`Failed in overdue reminder run: ${err?.message || err}`, err?.stack);
    }
  }

  async run(now: Date): Promise<OverdueReminderResult> {
    return this.dataSource.transaction(async (em) => {
      const result: OverdueReminderResult = { customer: 0, manager: 0 };
      const lock = (await em.query(`SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired`, [
        LOCK_NAME,
      ])) as Array<{ acquired: boolean }>;
      if (!lock?.[0]?.acquired) return result;

      const sends: Array<{ userId: string; payload: NotificationPayload }> = [];
      const managersByFacility = new Map<string, string[]>();
      for (const invoice of await this.loadOverdue(em, now)) {
        const days = daysOverdue(invoice.dueAt, now);
        if (isCustomerReminderDay(days)) {
          sends.push({
            userId: invoice.customerId,
            payload: customerOverdueNotification(invoice, days),
          });
        }
        if (isManagerAlertDay(days) && invoice.facilityId) {
          let managers = managersByFacility.get(invoice.facilityId);
          if (!managers) {
            managers = await activeRoleHolderIds(
              em,
              [UserRole.FACILITY_MANAGER],
              [invoice.facilityId],
            );
            managersByFacility.set(invoice.facilityId, managers);
          }
          for (const userId of managers) {
            sends.push({ userId, payload: managerOverdueAlert(invoice, days) });
          }
        }
      }

      const sent = await this.loadSentKeys(
        em,
        sends.map((s) => String(s.payload.data?.invoiceId)),
      );
      for (const { userId, payload } of sends) {
        const key = sentKey(
          userId,
          payload.type,
          payload.data?.invoiceId,
          payload.data?.daysOverdue,
        );
        if (sent.has(key)) continue;
        await this.notifications.createForUsers(em, [userId], payload);
        sent.add(key);
        if (payload.type === NotificationType.INVOICE_OVERDUE) result.customer += 1;
        else result.manager += 1;
      }
      return result;
    });
  }

  /** Unpaid invoices past their due day; drafts and cancelled contracts are not owed. */
  private async loadOverdue(em: EntityManager, now: Date): Promise<OverdueInvoice[]> {
    const rows = (await em.query(
      `SELECT i.id AS "invoiceId", i.invoice_no AS "invoiceNo", i.customer_id AS "customerId",
              u.full_name AS "customerName", i.contract_id AS "contractId", c.contract_no AS "contractNo",
              su.code AS "unitCode", su.facility_id AS "facilityId", i.due_at AS "dueAt",
              i.total, COALESCE(p.paid, 0) AS paid
         FROM invoices i
         JOIN app_users u ON u.id = i.customer_id
         LEFT JOIN contracts c ON c.id = i.contract_id
         LEFT JOIN booking_items bi ON bi.id = c.booking_item_id
         LEFT JOIN storage_units su ON su.id = bi.storage_unit_id
         LEFT JOIN LATERAL (
              SELECT SUM(amount) AS paid FROM payments
               WHERE invoice_id = i.id AND status = $4) p ON TRUE
        WHERE i.status = ANY($1::text[]) AND i.due_at IS NOT NULL AND i.due_at < $2
          AND (i.contract_id IS NULL
               OR (c.deleted_at IS NULL AND c.status <> ALL($3::text[])))`,
      [
        [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID],
        startOfVietnamDay(now),
        [ContractStatus.DRAFT, ContractStatus.CANCELLED],
        PaymentStatus.SUCCEEDED,
      ],
    )) as OverdueRow[];
    return rows.flatMap((row) => {
      const amountDue = Decimal.max(new Decimal(row.total).minus(row.paid), 0).ceil().toNumber();
      if (amountDue <= 0) return [];
      return [{ ...row, dueAt: new Date(row.dueAt), amountDue }];
    });
  }

  private async loadSentKeys(em: EntityManager, invoiceIds: string[]): Promise<Set<string>> {
    if (invoiceIds.length === 0) return new Set();
    const rows = (await em.query(
      `SELECT user_id AS "userId", type, data->>'invoiceId' AS "invoiceId",
              data->>'daysOverdue' AS "daysOverdue"
         FROM notifications
        WHERE type = ANY($1::text[]) AND data->>'invoiceId' = ANY($2::text[])`,
      [[NotificationType.INVOICE_OVERDUE, NotificationType.INVOICE_OVERDUE_ALERT], invoiceIds],
    )) as Array<{ userId: string; type: string; invoiceId: string; daysOverdue: string }>;
    return new Set(rows.map((r) => sentKey(r.userId, r.type, r.invoiceId, r.daysOverdue)));
  }
}

const sentKey = (userId: string, type: string, invoiceId: unknown, days: unknown): string =>
  `${userId}|${type}|${String(invoiceId)}|${String(days)}`;
