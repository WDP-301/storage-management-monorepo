import { NotificationsService } from '@modules/notifications/notifications.service';
import { SettingsService } from '@modules/settings/settings.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CheckOutMethod } from '@storage/types';
import { DataSource } from 'typeorm';
import { notifyMissedCheckOuts } from './missed-check-out.notify';
import { AUTO_CLOSE_NOTES, OPEN_VISIT } from './open-visit.query';

const LOCK_NAME = 'cron_visit_auto_close';
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The most recent closing time (Vietnam hour `closingHour`) at or before `now`. */
export function lastClosingTime(now: Date, closingHour: number): Date {
  const vn = new Date(now.getTime() + VIETNAM_OFFSET_MS);
  const today = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate(), closingHour);
  const closing = today - VIETNAM_OFFSET_MS;
  return new Date(closing > now.getTime() ? closing - DAY_MS : closing);
}

/**
 * Closes the visits still open when the warehouse closed, as a missed check-out, and tells the
 * facility managers. A visit that started after the last closing time is left alone until the
 * next one. Runs every 15 minutes, so it is never more than that late; an advisory lock keeps
 * concurrent instances from closing (and notifying) twice.
 */
@Injectable()
export class VisitAutoCloseService {
  private readonly logger = new Logger(VisitAutoCloseService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('*/15 * * * *')
  async handle(): Promise<void> {
    try {
      const closed = await this.run(new Date());
      if (closed > 0) this.logger.log(`Auto-closed ${closed} visit(s) at closing time`);
    } catch (err: any) {
      this.logger.error(`Failed to auto-close visits: ${err?.message || err}`, err?.stack);
    }
  }

  async run(now: Date): Promise<number> {
    const closingAt = lastClosingTime(now, await this.settings.getAccessClosingHour());
    return this.dataSource.transaction(async (em) => {
      const [{ acquired }] = (await em.query(
        `SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired`,
        [LOCK_NAME],
      )) as Array<{ acquired: boolean }>;
      if (!acquired) return 0;

      const [rows]: [{ id: string }[], number] = await em.query(
        `UPDATE "access_events" e
            SET "checked_out_at" = clock_timestamp(), "check_out_method" = $2,
                "check_out_note" = $3
          WHERE ${OPEN_VISIT} AND e."used_at" < $1
          RETURNING e."id"`,
        [closingAt, CheckOutMethod.AUTO, AUTO_CLOSE_NOTES.closingTime],
      );
      await notifyMissedCheckOuts(
        em,
        this.notifications,
        rows.map((row) => row.id),
      );
      return rows.length;
    });
  }
}
