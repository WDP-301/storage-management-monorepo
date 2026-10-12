import { AppUser } from '@entities/app-user.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { activeFacilityIds } from '@modules/auth/role-assignment.util';
import { hashSessionToken } from '@modules/auth/session.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { isGlobalManager } from '@modules/inspection/inspection-access.util';
import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { DataSource, type EntityManager, In, IsNull } from 'typeorm';
import { type CheckInView, toCheckInView } from './check-in.view';
import { assertCheckInAllowed, parsePayload } from './check-in-eligibility';

type PassRow = {
  id: string;
  contractId: string;
  storageUnitId: string;
  facilityId: string;
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
   * Consumes a scanned pass. The pass row stays locked for the whole transaction, so two
   * scanners of one code are serialised and the second sees `used_at`. A refused scan rolls
   * back without touching the pass: the customer can settle the problem and retry within TTL.
   */
  async verify(actor: AuthUser, payload: string): Promise<CheckInResult> {
    const token = parsePayload(payload);
    if (!token) throw invalidPass('MALFORMED');
    const tokenHash = hashSessionToken(token);

    return this.dataSource.transaction(async (em) => {
      // Expiry is evaluated by the database so pass creation and scan share one clock.
      const [pass]: PassRow[] = await em.query(
        `SELECT "id", "contract_id" AS "contractId", "storage_unit_id" AS "storageUnitId",
                "facility_id" AS "facilityId", "used_at" AS "usedAt", "verified_by" AS "verifiedBy",
                ("expires_at" <= now()) AS "expired"
           FROM "access_events"
          WHERE "qr_token_hash" = $1 AND "event_type" = 'CHECK_IN'
          FOR UPDATE`,
        [tokenHash],
      );
      if (!pass) throw invalidPass('NOT_FOUND');

      // Scope is checked before the pass state is reported, so other facilities learn nothing.
      if (!(await this.worksAtFacility(em, actor, pass.facilityId))) {
        throw new DomainException(
          ErrorCode.FORBIDDEN,
          'You do not work at the facility this pass belongs to',
          HttpStatus.FORBIDDEN,
        );
      }
      if (pass.usedAt) {
        throw invalidPass('USED', {
          usedAt: pass.usedAt,
          verifiedByMe: pass.verifiedBy === actor.id,
        });
      }
      if (pass.expired) throw invalidPass('EXPIRED');

      const contract = await em.findOne(Contract, {
        where: { id: pass.contractId, deletedAt: IsNull() },
      });
      if (!contract) {
        throw new DomainException(
          ErrorCode.CHECK_IN_NOT_ALLOWED,
          'This contract cannot be used to check in',
          HttpStatus.CONFLICT,
          { reason: 'CONTRACT_NOT_ACTIVE' },
        );
      }
      const item = await em.findOne(BookingItem, { where: { id: contract.bookingItemId } });
      const unit = item
        ? await em.findOne(StorageUnit, { where: { id: item.storageUnitId } })
        : null;
      // A change request may have moved the contract to another shelf since the pass was issued.
      if (!unit || unit.id !== pass.storageUnitId) throw invalidPass('NOT_FOUND');

      await assertCheckInAllowed(em, contract, unit, new Date());

      const [warehouse, facility, customer] = await Promise.all([
        unit.parentId ? em.findOne(StorageUnit, { where: { id: unit.parentId } }) : null,
        em.findOne(Facility, { where: { id: unit.facilityId } }),
        em.findOne(AppUser, { where: { id: contract.customerId } }),
      ]);

      // The postgres driver returns UPDATE … RETURNING as [rows, affectedCount], unlike SELECT/INSERT.
      const [[{ usedAt }]]: [{ usedAt: Date }[], number] = await em.query(
        `UPDATE "access_events" SET "used_at" = now(), "verified_by" = $2
          WHERE "id" = $1 RETURNING "used_at" AS "usedAt"`,
        [pass.id, actor.id],
      );

      const { verifiedBy: _omitted, ...view } = toCheckInView({
        id: pass.id,
        contractId: contract.id,
        usedAt,
        contract: { ...contract, customer } as Contract,
        storageUnit: { ...unit, parent: warehouse } as StorageUnit,
        facility,
      } as never);
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
