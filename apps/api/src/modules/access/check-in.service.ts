import { AppUser } from '@entities/app-user.entity';
import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { hashSessionToken } from '@modules/auth/session.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { AccessEventType, CheckOutMethod, StorageUnitKind } from '@storage/types';
import { DataSource } from 'typeorm';
import { type CheckInView, toCheckInView } from './check-in.view';
import { assertCustomerCanEnter, parsePayload } from './check-in-eligibility';
import { notifyMissedCheckOuts } from './missed-check-out.notify';
import { AUTO_CLOSE_NOTES, closeVisit, findOpenVisit } from './open-visit.query';
import { assertWorksAtFacility } from './staff-facility.util';

type PassRow = {
  id: string;
  customerId: string;
  usedAt: Date | null;
  verifiedBy: string | null;
  expired: boolean;
};

/** IN opens a visit; OUT closes the visit that was open at this warehouse. */
export type ScanDirection = 'IN' | 'OUT';

export type CheckInResult = CheckInView & {
  direction: ScanDirection;
  /** OUT only: when the visit being closed started. */
  checkedInAt: Date | null;
};

const invalidPass = (reason: string, details: Record<string, unknown> = {}) =>
  new DomainException(
    ErrorCode.ACCESS_PASS_INVALID,
    'This QR code cannot be used',
    HttpStatus.CONFLICT,
    { reason, ...details },
  );

@Injectable()
export class CheckInService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Consumes a scanned pass at the warehouse the staff member chose. The direction follows the
   * customer's open visit: open here → exit (never refused, whatever the customer owes); otherwise
   * an entry, which needs a started shelf contract here and no overdue invoice. An entry while a
   * visit is still open elsewhere closes that one as a missed check-out.
   *
   * The pass row stays locked for the whole transaction, so two scanners of one code are
   * serialised and the second sees `used_at`. A refused scan rolls back without touching the
   * pass: the customer can settle the problem and retry within TTL.
   */
  async verify(actor: AuthUser, payload: string, warehouseId: string): Promise<CheckInResult> {
    const token = parsePayload(payload);
    if (!token) throw invalidPass('MALFORMED');
    const tokenHash = hashSessionToken(token);

    return this.dataSource.transaction(async (em) => {
      const warehouse = await em.findOne(StorageUnit, {
        where: { id: warehouseId, kind: StorageUnitKind.SHELF_WAREHOUSE },
      });
      if (!warehouse) notFound('Warehouse', warehouseId);
      // Scope is checked before any pass is read, so other facilities learn nothing about it.
      await assertWorksAtFacility(em, actor, warehouse.facilityId);

      // Expiry is evaluated by the database so pass creation and scan share one clock. It reads
      // clock_timestamp(), not now(): the transaction may have started before waiting on this lock.
      const [pass]: PassRow[] = await em.query(
        `SELECT "id", "customer_id" AS "customerId", "used_at" AS "usedAt",
                "verified_by" AS "verifiedBy", ("expires_at" <= clock_timestamp()) AS "expired"
           FROM "access_events"
          WHERE "qr_token_hash" = $1
          FOR UPDATE`,
        [tokenHash],
      );
      if (!pass) throw invalidPass('NOT_FOUND');
      if (pass.usedAt) {
        throw invalidPass('USED', {
          usedAt: pass.usedAt,
          verifiedByMe: pass.verifiedBy === actor.id,
        });
      }
      if (pass.expired) throw invalidPass('EXPIRED');

      const openVisit = await findOpenVisit(em, pass.customerId, { lock: true });
      const direction: ScanDirection = openVisit?.warehouseId === warehouse.id ? 'OUT' : 'IN';

      if (direction === 'IN') {
        await assertCustomerCanEnter(em, pass.customerId, new Date(), warehouse.id);
        if (openVisit) {
          await closeVisit(em, openVisit.id, {
            method: CheckOutMethod.AUTO,
            by: null,
            note: AUTO_CLOSE_NOTES.otherWarehouse,
          });
          await notifyMissedCheckOuts(em, this.notifications, [openVisit.id]);
        }
      }

      // The postgres driver returns UPDATE … RETURNING as [rows, affectedCount], unlike SELECT/INSERT.
      const [[{ usedAt }]]: [{ usedAt: Date }[], number] = await em.query(
        `UPDATE "access_events"
            SET "used_at" = clock_timestamp(), "verified_by" = $2,
                "warehouse_id" = $3, "facility_id" = $4, "event_type" = $5
          WHERE "id" = $1 RETURNING "used_at" AS "usedAt"`,
        [
          pass.id,
          actor.id,
          warehouse.id,
          warehouse.facilityId,
          direction === 'OUT' ? AccessEventType.CHECK_OUT : AccessEventType.CHECK_IN,
        ],
      );
      if (direction === 'OUT' && openVisit) {
        await closeVisit(em, openVisit.id, {
          method: CheckOutMethod.SCAN,
          by: actor.id,
          checkOutEventId: pass.id,
        });
      }

      const [facility, customer] = await Promise.all([
        em.findOne(Facility, { where: { id: warehouse.facilityId } }),
        em.findOne(AppUser, { where: { id: pass.customerId } }),
      ]);
      const {
        verifiedBy: _verifier,
        checkedOutAt: _out,
        checkOutMethod: _method,
        ...view
      } = toCheckInView({
        id: pass.id,
        usedAt,
        customer: customer ?? undefined,
        warehouse,
        facility,
      });
      return {
        ...view,
        direction,
        checkedInAt: direction === 'OUT' && openVisit ? openVisit.usedAt : null,
      };
    });
  }
}
