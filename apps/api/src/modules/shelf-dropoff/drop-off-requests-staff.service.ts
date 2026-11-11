import { DropOffRequest } from '@entities/drop-off-request.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { assertWorksAtFacility } from '@modules/access/staff-facility.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { Injectable } from '@nestjs/common';
import { notFound } from '@shared/exceptions/domain.exception';
import {
  ContractStatus,
  DropOffRequestStatus,
  type DropOffRequestView,
  StorageUnitKind,
} from '@storage/types';
import { DataSource } from 'typeorm';
import { loadDropOffRequests } from '../shelf-storage/drop-off-request.read';
import { findShelfContracts } from '../shelf-storage/shelf-contract.query';
import { notifyDropOffConfirmed } from './drop-off-notifications';
import { lockDropOffStatus, notAllowed } from './drop-off-requests.service';

const ALL_LIMIT = 50;

/** Staff side of drop-off requests, always scoped to the facility of the warehouse. */
@Injectable()
export class DropOffRequestsStaffService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  async listForWarehouse(
    warehouseId: string,
    status: 'OPEN' | 'ALL',
    actor: AuthUser,
  ): Promise<DropOffRequestView[]> {
    const em = this.dataSource.manager;
    const warehouse = await em.findOne(StorageUnit, { where: { id: warehouseId } });
    if (!warehouse || warehouse.kind !== StorageUnitKind.SHELF_WAREHOUSE) {
      notFound('Shelf warehouse', warehouseId);
    }
    await assertWorksAtFacility(em, actor, warehouse.facilityId);
    return status === 'ALL'
      ? loadDropOffRequests(em, { warehouseId, order: 'newest', limit: ALL_LIMIT })
      : loadDropOffRequests(em, { warehouseId, open: true, order: 'requestedFor' });
  }

  /** The branch is ready to receive the goods; the customer is told to bring their code. */
  async confirm(id: string, actor: AuthUser): Promise<DropOffRequestView> {
    return this.dataSource.transaction(async (em) => {
      const [view] = await loadDropOffRequests(em, { ids: [id], order: 'newest' });
      if (!view) notFound('Drop-off request', id);
      const [contract] = await findShelfContracts(em, { contractId: view.contractId, lock: true });
      if (!contract) notFound('Drop-off request', id);
      await assertWorksAtFacility(em, actor, contract.facility.id);
      const status = await lockDropOffStatus(em, id);
      if (status !== DropOffRequestStatus.PENDING) {
        throw notAllowed('NOT_PENDING', 'Only a pending request can be confirmed', { status });
      }
      if (contract.status !== ContractStatus.ACTIVE) {
        throw notAllowed('CONTRACT_NOT_ACTIVE', 'The contract is no longer active');
      }
      await em.update(
        DropOffRequest,
        { id },
        {
          status: DropOffRequestStatus.CONFIRMED,
          confirmedAt: new Date(),
          confirmedBy: actor.id,
        },
      );
      const [updated] = await loadDropOffRequests(em, { ids: [id], order: 'newest' });
      await notifyDropOffConfirmed(em, this.notifications, updated);
      return updated;
    });
  }
}
