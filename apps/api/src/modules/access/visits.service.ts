import { StorageUnit } from '@entities/storage-unit.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { CheckOutMethod, StorageUnitKind } from '@storage/types';
import { DataSource, type EntityManager } from 'typeorm';
import { closeVisit, OPEN_VISIT } from './open-visit.query';
import { assertWorksAtFacility } from './staff-facility.util';
import {
  toVisitView,
  VISIT_COLUMNS,
  VISIT_JOINS,
  type VisitRow,
  type VisitView,
} from './visit.view';

const MY_RECENT_VISITS = 10;

@Injectable()
export class VisitsService {
  constructor(private readonly dataSource: DataSource) {}

  /** Who is inside a shelf warehouse right now, earliest arrival first. */
  async listInside(actor: AuthUser, warehouseId: string): Promise<VisitView[]> {
    const em = this.dataSource.manager;
    const warehouse = await em.findOne(StorageUnit, {
      where: { id: warehouseId, kind: StorageUnitKind.SHELF_WAREHOUSE },
    });
    if (!warehouse) notFound('Warehouse', warehouseId);
    await assertWorksAtFacility(em, actor, warehouse.facilityId);

    const rows: VisitRow[] = await em.query(
      `SELECT ${VISIT_COLUMNS}
         FROM "access_events" e ${VISIT_JOINS}
        WHERE e."warehouse_id" = $1 AND ${OPEN_VISIT}
        ORDER BY e."used_at" ASC`,
      [warehouseId],
    );
    return rows.map(toVisitView);
  }

  /**
   * Staff close a visit by hand when the customer left without the exit scan (phone dead, left
   * while staff were busy). The note says why; the visit is locked so it races neither a scan nor
   * the closing-time sweep.
   */
  async checkOutManually(actor: AuthUser, visitId: string, note: string): Promise<VisitView> {
    return this.dataSource.transaction(async (em) => {
      const [visit]: { id: string; facilityId: string; open: boolean }[] = await em.query(
        `SELECT e."id", e."facility_id" AS "facilityId", (${OPEN_VISIT}) AS "open"
           FROM "access_events" e
          WHERE e."id" = $1 AND e."event_type" = 'CHECK_IN' AND e."used_at" IS NOT NULL
          FOR UPDATE`,
        [visitId],
      );
      if (!visit) notFound('Visit', visitId);
      await assertWorksAtFacility(em, actor, visit.facilityId);
      if (!visit.open) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'This visit is already checked out',
          HttpStatus.CONFLICT,
          { reason: 'ALREADY_CHECKED_OUT' },
        );
      }
      await closeVisit(em, visitId, {
        method: CheckOutMethod.MANUAL,
        by: actor.id,
        note: note.trim(),
      });
      return this.loadVisit(em, visitId);
    });
  }

  /** The caller's current visit (if inside) and their latest visits, newest first. */
  async mine(user: AuthUser): Promise<{ current: VisitView | null; recent: VisitView[] }> {
    const rows: VisitRow[] = await this.dataSource.manager.query(
      `SELECT ${VISIT_COLUMNS}
         FROM "access_events" e ${VISIT_JOINS}
        WHERE e."customer_id" = $1 AND e."event_type" = 'CHECK_IN' AND e."used_at" IS NOT NULL
        ORDER BY e."used_at" DESC
        LIMIT $2`,
      [user.id, MY_RECENT_VISITS],
    );
    const recent = rows.map(toVisitView);
    return { current: recent.find((visit) => visit.checkedOutAt === null) ?? null, recent };
  }

  private async loadVisit(em: EntityManager, visitId: string): Promise<VisitView> {
    const [row]: VisitRow[] = await em.query(
      `SELECT ${VISIT_COLUMNS} FROM "access_events" e ${VISIT_JOINS} WHERE e."id" = $1`,
      [visitId],
    );
    return toVisitView(row);
  }
}
