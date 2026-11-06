import { StorageUnit } from '@entities/storage-unit.entity';
import { parsePayload, refuseCheckIn } from '@modules/access/check-in-eligibility';
import {
  assertPassUnused,
  invalidPass,
  lockPass,
  markPassUsedAtCounter,
} from '@modules/access/pass-consume.util';
import { assertWorksAtFacility } from '@modules/access/staff-facility.util';
import { hashSessionToken } from '@modules/auth/session.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { Injectable } from '@nestjs/common';
import { notFound } from '@shared/exceptions/domain.exception';
import {
  AccessEventType,
  ContractStatus,
  type CounterSessionView,
  StorageUnitKind,
} from '@storage/types';
import { DataSource } from 'typeorm';
import { buildCounterPanel } from './counter-panel.query';
import { assertLiveSession, type CounterSession } from './counter-session.util';
import { findShelfContracts } from './shelf-contract.query';
import { COUNTER_SESSION_MINUTES } from './shelf-rules';

@Injectable()
export class CounterSessionsService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Consumes a scanned pass at the warehouse the staff member chose; the consumed pass is the
   * counter session. The customer needs an ACTIVE shelf contract here, but debt is not judged
   * now: the panel carries the per-action block reasons. A refusal rolls back, so the pass is
   * not consumed and the customer can retry within its TTL. Scanning again a pass this staff
   * member consumed here, while its session is live, reopens the same session (camera double fire).
   */
  async open(actor: AuthUser, payload: string, warehouseId: string): Promise<CounterSessionView> {
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

      const pass = await lockPass(em, tokenHash);
      const mine =
        pass.verifiedBy === actor.id &&
        pass.eventType === AccessEventType.COUNTER_SCAN &&
        pass.warehouseId === warehouse.id;
      if (pass.usedAt && mine && pass.live) {
        return buildCounterPanel(em, await assertLiveSession(em, actor, pass.id));
      }
      assertPassUnused(pass, actor.id);

      const contracts = await findShelfContracts(em, {
        customerId: pass.customerId,
        warehouseId: warehouse.id,
        statuses: [ContractStatus.ACTIVE],
      });
      if (contracts.length === 0) throw refuseCheckIn('NO_SHELF_CONTRACT');

      const startedAt = await markPassUsedAtCounter(em, pass.id, actor.id, warehouse);
      const session: CounterSession = {
        id: pass.id,
        customerId: pass.customerId,
        warehouseId: warehouse.id,
        facilityId: warehouse.facilityId,
        startedAt,
        expiresAt: new Date(startedAt.getTime() + COUNTER_SESSION_MINUTES * 60_000),
      };
      return buildCounterPanel(em, session);
    });
  }

  /** Fresh panel of a live session; only the staff member who scanned it can read it. */
  async get(actor: AuthUser, sessionId: string): Promise<CounterSessionView> {
    const em = this.dataSource.manager;
    return buildCounterPanel(em, await assertLiveSession(em, actor, sessionId));
  }
}
