import { AppUser } from '@entities/app-user.entity';
import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { activeFacilityIds } from '@modules/auth/role-assignment.util';
import { hashSessionToken } from '@modules/auth/session.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { isGlobalManager } from '@modules/inspection/inspection-access.util';
import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { StorageUnitKind, UserRole } from '@storage/types';
import { DataSource, type EntityManager, In } from 'typeorm';
import { type CheckInView, toCheckInView } from './check-in.view';
import { assertCustomerCanEnter, parsePayload } from './check-in-eligibility';

type PassRow = {
  id: string;
  customerId: string;
  usedAt: Date | null;
  verifiedBy: string | null;
  expired: boolean;
};

export type CheckInResult = CheckInView & { eventId: string };

const invalidPass = (reason: string, details: Record<string, unknown> = {}) =>
  new DomainException(
    ErrorCode.ACCESS_PASS_INVALID,
    'This QR code cannot be used',
    HttpStatus.CONFLICT,
    { reason, ...details },
  );

@Injectable()
export class CheckInService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Consumes a scanned pass at the warehouse the staff member chose; the customer must rent a
   * shelf there. The pass row stays locked for the whole transaction, so two scanners of one code
   * are serialised and the second sees `used_at`. A refused scan rolls back without touching the
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
      if (!(await this.worksAtFacility(em, actor, warehouse.facilityId))) {
        throw new DomainException(
          ErrorCode.FORBIDDEN,
          'You do not work at the facility of this warehouse',
          HttpStatus.FORBIDDEN,
        );
      }

      // Expiry is evaluated by the database so pass creation and scan share one clock. It reads
      // clock_timestamp(), not now(): the transaction may have started before waiting on this lock.
      const [pass]: PassRow[] = await em.query(
        `SELECT "id", "customer_id" AS "customerId", "used_at" AS "usedAt",
                "verified_by" AS "verifiedBy", ("expires_at" <= clock_timestamp()) AS "expired"
           FROM "access_events"
          WHERE "qr_token_hash" = $1 AND "event_type" = 'CHECK_IN'
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

      await assertCustomerCanEnter(em, pass.customerId, new Date(), warehouse.id);

      const [facility, customer] = await Promise.all([
        em.findOne(Facility, { where: { id: warehouse.facilityId } }),
        em.findOne(AppUser, { where: { id: pass.customerId } }),
      ]);

      // The postgres driver returns UPDATE … RETURNING as [rows, affectedCount], unlike SELECT/INSERT.
      const [[{ usedAt }]]: [{ usedAt: Date }[], number] = await em.query(
        `UPDATE "access_events"
            SET "used_at" = clock_timestamp(), "verified_by" = $2,
                "warehouse_id" = $3, "facility_id" = $4
          WHERE "id" = $1 RETURNING "used_at" AS "usedAt"`,
        [pass.id, actor.id, warehouse.id, warehouse.facilityId],
      );

      const { verifiedBy: _omitted, ...view } = toCheckInView({
        id: pass.id,
        usedAt,
        customer: customer ?? undefined,
        warehouse,
        facility,
      });
      return view;
    });
  }

  /** Global managers work everywhere; staff and facility managers at their assigned facilities. */
  private async worksAtFacility(
    em: EntityManager,
    actor: AuthUser,
    facilityId: string,
  ): Promise<boolean> {
    if (isGlobalManager(actor)) return true;
    const assignments = await em.find(UserRoleAssignment, {
      where: {
        userId: actor.id,
        role: In([UserRole.FACILITY_MANAGER, UserRole.FACILITY_STAFF]),
      },
    });
    return activeFacilityIds(assignments).includes(facilityId);
  }
}
