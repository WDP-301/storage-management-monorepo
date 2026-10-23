import { generateSessionToken, hashSessionToken } from '@modules/auth/session.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { SettingsService } from '@modules/settings/settings.service';
import { Injectable } from '@nestjs/common';
import { AccessEventType } from '@storage/types';
import { DataSource } from 'typeorm';
import { assertCustomerCanEnter, buildPayload } from './check-in-eligibility';
import { findOpenVisit } from './open-visit.query';

export interface AccessPassView {
  id: string;
  qrPayload: string;
  expiresAt: Date;
  ttlSeconds: number;
}

@Injectable()
export class AccessPassService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Issues the caller's single live check-in pass, valid at every warehouse where they rent a
   * shelf; staff choose the warehouse when scanning. The app rotates it before it expires, and
   * issuing a new one expires the earlier unused ones, so a screenshot shared before stops working.
   */
  async createPass(user: AuthUser): Promise<AccessPassView> {
    const ttlMinutes = await this.settings.getCheckInQrTtlMinutes();
    const token = generateSessionToken();

    return this.dataSource.transaction(async (em) => {
      // Locking the customer serialises concurrent issues; otherwise two parallel requests would
      // both expire the old passes and both insert, leaving two live passes. NO KEY UPDATE leaves
      // foreign-key checks on the user (sessions, a scan's verified_by) unblocked.
      await em.query(`SELECT 1 FROM "app_users" WHERE "id" = $1 FOR NO KEY UPDATE`, [user.id]);

      // A customer inside a warehouse always gets a code: it is their way out, and leaving is
      // never refused. Otherwise the entry rules are checked now so the customer learns early.
      if (!(await findOpenVisit(em, user.id))) {
        await assertCustomerCanEnter(em, user.id, new Date());
      }

      // The app issues a pass on every rotation, so unused ones would pile up forever. Passes that
      // expired over a day ago are dropped here; recent ones stay so a stale scan reads "expired".
      await em.query(
        `DELETE FROM "access_events"
          WHERE "customer_id" = $1 AND "used_at" IS NULL AND "expires_at" < now() - interval '1 day'`,
        [user.id],
      );
      await em.query(
        `UPDATE "access_events" SET "expires_at" = now() - interval '1 second'
          WHERE "customer_id" = $1 AND "used_at" IS NULL AND "expires_at" > now()`,
        [user.id],
      );
      // Expiry comes from the database clock, the same one the scan compares against.
      const [pass]: { id: string; expires_at: Date }[] = await em.query(
        `INSERT INTO "access_events" ("customer_id", "event_type", "qr_token_hash", "expires_at")
         VALUES ($1, $2, $3, now() + make_interval(mins => $4))
         RETURNING "id", "expires_at"`,
        [user.id, AccessEventType.CHECK_IN, hashSessionToken(token), ttlMinutes],
      );

      return {
        id: pass.id,
        qrPayload: buildPayload(token),
        expiresAt: pass.expires_at,
        ttlSeconds: Math.max(0, Math.round((pass.expires_at.getTime() - Date.now()) / 1000)),
      };
    });
  }
}
