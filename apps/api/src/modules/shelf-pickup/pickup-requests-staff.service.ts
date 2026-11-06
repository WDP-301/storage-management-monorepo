import { PickupRequest } from '@entities/pickup-request.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { assertWorksAtFacility } from '@modules/access/staff-facility.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { Injectable } from '@nestjs/common';
import { notFound } from '@shared/exceptions/domain.exception';
import { PickupRequestStatus, type PickupRequestView, StorageUnitKind } from '@storage/types';
import { DataSource } from 'typeorm';
import { loadPickupRequests } from '../shelf-storage/pickup-request.read';
import { findShelfContracts } from '../shelf-storage/shelf-contract.query';
import { notifyRequestReady } from './pickup-notifications';
import { lockRequestStatus, notAllowed } from './pickup-requests.service';

const ALL_LIMIT = 50;

/** Staff side of pick-up requests, always scoped to the facility of the warehouse. */
@Injectable()
export class PickupRequestsStaffService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  async listForWarehouse(
    warehouseId: string,
    status: 'OPEN' | 'ALL',
    actor: AuthUser,
  ): Promise<PickupRequestView[]> {
    const em = this.dataSource.manager;
    const warehouse = await em.findOne(StorageUnit, { where: { id: warehouseId } });
    if (!warehouse || warehouse.kind !== StorageUnitKind.SHELF_WAREHOUSE) {
      notFound('Shelf warehouse', warehouseId);
    }
    await assertWorksAtFacility(em, actor, warehouse.facilityId);
    return status === 'ALL'
      ? loadPickupRequests(em, { warehouseId, order: 'newest', limit: ALL_LIMIT })
      : loadPickupRequests(em, { warehouseId, open: true, order: 'requestedFor' });
  }

  async markReady(id: string, actor: AuthUser): Promise<PickupRequestView> {
    return this.dataSource.transaction(async (em) => {
      const [view] = await loadPickupRequests(em, { ids: [id], order: 'newest' });
      if (!view) notFound('Pick-up request', id);
      const [contract] = await findShelfContracts(em, { contractId: view.contractId, lock: true });
      if (!contract) notFound('Pick-up request', id);
      await assertWorksAtFacility(em, actor, contract.facility.id);
      const status = await lockRequestStatus(em, id);
      if (status !== PickupRequestStatus.PENDING) {
        throw notAllowed('NOT_PENDING', 'Only a pending request can be marked ready', { status });
      }
      await em.update(
        PickupRequest,
        { id },
        {
          status: PickupRequestStatus.READY,
          readyAt: new Date(),
          readyBy: actor.id,
        },
      );
      const [updated] = await loadPickupRequests(em, { ids: [id], order: 'newest' });
      await notifyRequestReady(em, this.notifications, updated);
      return updated;
    });
  }
}
