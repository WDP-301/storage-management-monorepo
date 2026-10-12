import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { generateSessionToken, hashSessionToken } from '@modules/auth/session.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { SettingsService } from '@modules/settings/settings.service';
import { Injectable } from '@nestjs/common';
import { notFound } from '@shared/exceptions/domain.exception';
import { AccessEventType } from '@storage/types';
import { DataSource, IsNull } from 'typeorm';
import { assertCheckInAllowed, buildPayload } from './check-in-eligibility';

export interface AccessPassView {
  id: string;
  qrPayload: string;
  expiresAt: Date;
  ttlSeconds: number;
  contract: { id: string; contractNo: string };
  unit: { code: string; name: string };
}

@Injectable()
export class AccessPassService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Issues the caller's single live check-in pass for a shelf contract. Generating a new pass
   * expires the earlier unused ones, so a screenshot shared before stops working.
   */
  async createPass(user: AuthUser, contractId: string): Promise<AccessPassView> {
    const ttlMinutes = await this.settings.getCheckInQrTtlMinutes();
    const token = generateSessionToken();

    return this.dataSource.transaction(async (em) => {
      // Locking the contract serialises concurrent generates; otherwise two parallel requests
      // would both expire the old passes and both insert, leaving two live passes.
      // Another customer's contract answers 404 so its existence is not revealed.
      const contract = await em.findOne(Contract, {
        where: { id: contractId, customerId: user.id, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contract) notFound('Contract', contractId);

      const item = await em.findOne(BookingItem, {
        where: { id: contract.bookingItemId },
        relations: { storageUnit: true },
      });
      const unit = item?.storageUnit;
      if (!unit) notFound('Contract', contractId);

      await assertCheckInAllowed(em, contract, unit, new Date());

      await em.query(
        `UPDATE "access_events" SET "expires_at" = now() - interval '1 second'
          WHERE "contract_id" = $1 AND "used_at" IS NULL AND "expires_at" > now()`,
        [contract.id],
      );
      // Expiry comes from the database clock, the same one the scan compares against.
      const [pass]: { id: string; expires_at: Date }[] = await em.query(
        `INSERT INTO "access_events"
           ("contract_id", "event_type", "qr_token_hash", "storage_unit_id", "facility_id", "expires_at")
         VALUES ($1, $2, $3, $4, $5, now() + make_interval(mins => $6))
         RETURNING "id", "expires_at"`,
        [
          contract.id,
          AccessEventType.CHECK_IN,
          hashSessionToken(token),
          unit.id,
          unit.facilityId,
          ttlMinutes,
        ],
      );

      return {
        id: pass.id,
        qrPayload: buildPayload(token),
        expiresAt: pass.expires_at,
        ttlSeconds: Math.max(0, Math.round((pass.expires_at.getTime() - Date.now()) / 1000)),
        contract: { id: contract.id, contractNo: contract.contractNo },
        unit: { code: unit.code, name: unit.name },
      };
    });
  }
}
