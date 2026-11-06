import { findOverdueInvoiceNos } from '@modules/access/overdue-invoices.query';
import { notFound } from '@shared/exceptions/domain.exception';
import {
  ContractStatus,
  type CounterContractView,
  type CounterSessionView,
  type ShelfPersonRef,
  type ShelfRef,
} from '@storage/types';
import type { EntityManager } from 'typeorm';
import type { CounterSession } from './counter-session.util';
import { loadPickupRequests } from './pickup-request.read';
import { findShelfContracts, loadStock } from './shelf-contract.query';
import { loadReceipts } from './shelf-receipt.read';
import { dropOffBlock, pickUpBlock } from './shelf-rules';

const RECENT_RECEIPTS = 5;

interface PlaceRow {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  facilityId: string;
  facilityCode: string;
  facilityName: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
}

/**
 * What the counter shows for a live session: the customer and every ACTIVE shelf contract they
 * hold in the session's warehouse, with fresh stock, the open pick-up request, recent receipts
 * and why a drop-off or pick-up would be refused right now. One query per kind of data, however
 * many contracts there are.
 */
export async function buildCounterPanel(
  em: EntityManager,
  session: CounterSession,
  now: Date = new Date(),
): Promise<CounterSessionView> {
  const [place]: PlaceRow[] = await em.query(
    `SELECT w."id" AS "warehouseId", w."code" AS "warehouseCode", w."name" AS "warehouseName",
            f."id" AS "facilityId", f."code" AS "facilityCode", f."name" AS "facilityName",
            cu."id" AS "customerId", cu."full_name" AS "customerName", cu."phone" AS "customerPhone"
       FROM "storage_units" w
       JOIN "facilities" f ON f."id" = w."facility_id"
       CROSS JOIN "app_users" cu
      WHERE w."id" = $1 AND cu."id" = $2`,
    [session.warehouseId, session.customerId],
  );
  if (!place) notFound('Counter session');

  const contracts = await findShelfContracts(em, {
    customerId: session.customerId,
    warehouseId: session.warehouseId,
    statuses: [ContractStatus.ACTIVE],
  });
  const ids = contracts.map((contract) => contract.id);
  const [stock, requests, recent, overdueInvoiceNos] = await Promise.all([
    loadStock(em, ids),
    ids.length > 0
      ? loadPickupRequests(em, { contractIds: ids, open: true, order: 'requestedFor' })
      : [],
    ids.length > 0
      ? loadReceipts(em, { contractIds: ids, recentPerContract: RECENT_RECEIPTS })
      : { receipts: [], total: 0 },
    findOverdueInvoiceNos(em, session.customerId, now),
  ]);
  const overdue = overdueInvoiceNos.length > 0;

  const views = contracts.map((contract): CounterContractView => {
    const items = stock.get(contract.id) ?? [];
    const total = items.reduce((sum, item) => sum + item.quantity, 0);
    return {
      contractId: contract.id,
      contractNo: contract.contractNo,
      effectiveAt: contract.effectiveAt,
      shelf: contract.shelf,
      returnOpen: contract.returnOpen,
      dropOff: dropOffBlock(contract, overdue, now),
      pickUp: pickUpBlock(total, overdue, contract.returnOpen),
      items,
      openRequest: requests.find((request) => request.contractId === contract.id) ?? null,
      recentReceipts: recent.receipts.filter((receipt) => receipt.contractId === contract.id),
    };
  });

  const warehouse: ShelfRef = {
    id: place.warehouseId,
    code: place.warehouseCode,
    name: place.warehouseName,
  };
  const facility: ShelfRef = {
    id: place.facilityId,
    code: place.facilityCode,
    name: place.facilityName,
  };
  const customer: ShelfPersonRef = {
    id: place.customerId,
    fullName: place.customerName,
    phone: place.customerPhone,
  };
  return {
    sessionId: session.id,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    warehouse,
    facility,
    customer,
    overdueInvoiceNos,
    contracts: views,
  };
}
