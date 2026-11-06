import { StorageUnit } from '@entities/storage-unit.entity';
import { findOverdueInvoiceNos } from '@modules/access/overdue-invoices.query';
import { assertWorksAtFacility, worksAtFacility } from '@modules/access/staff-facility.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { buildPaginationMeta, ErrorCode } from '@shared/models/api-response';
import {
  type ShelfContractStorageView,
  type ShelfReceiptPage,
  type ShelfReceiptView,
  StorageUnitKind,
  UserRole,
} from '@storage/types';
import { DataSource, type EntityManager } from 'typeorm';
import { loadPickupRequests } from './pickup-request.read';
import { findShelfContracts, loadStock, type ShelfContractRow } from './shelf-contract.query';
import { loadReceipts } from './shelf-receipt.read';
import { pickupRequestBlock } from './shelf-rules';

const STAFF_ROLES: readonly UserRole[] = [
  UserRole.FACILITY_STAFF,
  UserRole.FACILITY_MANAGER,
  UserRole.OPERATIONS_MANAGER,
  UserRole.ADMIN,
];

const isStaff = (actor: AuthUser) => actor.roles.some((role) => STAFF_ROLES.includes(role));

/**
 * Anyone reads their own records, staff or not. Otherwise a customer reads nothing of anyone
 * else's (404, so ids reveal nothing) and staff read what belongs to the facilities they work at
 * (403 otherwise).
 */
async function assertCanRead(
  em: EntityManager,
  actor: AuthUser,
  owner: { customerId: string; facilityId: string },
  resource: string,
): Promise<void> {
  if (owner.customerId === actor.id) return;
  if (isStaff(actor)) {
    if (!(await worksAtFacility(em, actor, owner.facilityId))) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not work at the facility of this record',
        HttpStatus.FORBIDDEN,
      );
    }
  } else if (owner.customerId !== actor.id) {
    notFound(resource);
  }
}

export interface PageQuery {
  page?: number;
  limit?: number;
  search?: string;
}

@Injectable()
export class ShelfStorageReadsService {
  constructor(private readonly dataSource: DataSource) {}

  async getReceipt(actor: AuthUser, id: string): Promise<ShelfReceiptView> {
    const em = this.dataSource.manager;
    const [receipt] = (await loadReceipts(em, { ids: [id] })).receipts;
    if (!receipt) notFound('Receipt', id);
    await assertCanRead(
      em,
      actor,
      { customerId: receipt.customer.id, facilityId: receipt.facility.id },
      'Receipt',
    );
    return receipt;
  }

  /** Stock of one contract, whatever its status, plus whether the customer may ask for a pick-up. */
  async getContract(actor: AuthUser, contractId: string): Promise<ShelfContractStorageView> {
    const em = this.dataSource.manager;
    const contract = await this.readableContract(em, actor, contractId);
    const [stock, requests, invoiceNos] = await Promise.all([
      loadStock(em, [contract.id]),
      loadPickupRequests(em, { contractIds: [contract.id], open: true, order: 'requestedFor' }),
      findOverdueInvoiceNos(em, contract.customerId, new Date()),
    ]);
    const items = stock.get(contract.id) ?? [];
    const openRequest = requests[0] ?? null;
    return {
      contractId: contract.id,
      contractNo: contract.contractNo,
      contractStatus: contract.status,
      shelf: contract.shelf,
      warehouse: contract.warehouse,
      items,
      openRequest,
      pickupRequestBlock: pickupRequestBlock({
        status: contract.status,
        stockTotal: items.reduce((sum, item) => sum + item.quantity, 0),
        hasOpenRequest: openRequest !== null,
        overdue: invoiceNos.length > 0,
        returnOpen: contract.returnOpen,
      }),
    };
  }

  async listContractReceipts(
    actor: AuthUser,
    contractId: string,
    query: PageQuery,
  ): Promise<ShelfReceiptPage> {
    const em = this.dataSource.manager;
    const contract = await this.readableContract(em, actor, contractId);
    return this.page(em, { contractIds: [contract.id] }, query);
  }

  async listWarehouseReceipts(
    actor: AuthUser,
    warehouseId: string,
    query: PageQuery,
  ): Promise<ShelfReceiptPage> {
    const em = this.dataSource.manager;
    const warehouse = await em.findOne(StorageUnit, {
      where: { id: warehouseId, kind: StorageUnitKind.SHELF_WAREHOUSE },
    });
    if (!warehouse) notFound('Warehouse', warehouseId);
    await assertWorksAtFacility(em, actor, warehouse.facilityId);
    return this.page(em, { warehouseId, search: query.search }, query);
  }

  private async readableContract(
    em: EntityManager,
    actor: AuthUser,
    contractId: string,
  ): Promise<ShelfContractRow> {
    const [contract] = await findShelfContracts(em, { contractId });
    if (!contract) notFound('Contract', contractId);
    await assertCanRead(
      em,
      actor,
      { customerId: contract.customerId, facilityId: contract.facility.id },
      'Contract',
    );
    return contract;
  }

  private async page(
    em: EntityManager,
    filter: { contractIds?: string[]; warehouseId?: string; search?: string },
    { page = 1, limit = 20 }: PageQuery,
  ): Promise<ShelfReceiptPage> {
    const { receipts, total } = await loadReceipts(em, { ...filter, page, limit });
    return { receipts, meta: buildPaginationMeta(page, limit, total) };
  }
}
