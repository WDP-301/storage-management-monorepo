import {
  ContractStatus,
  type PickupRequestView,
  type ShelfPersonRef,
  type WarehouseShelfStockView,
} from '@storage/types';
import type { EntityManager } from 'typeorm';
import { loadPickupRequests } from './pickup-request.read';
import { findShelfContracts, loadStock } from './shelf-contract.query';

/**
 * What is stored in a warehouse: one row per ACTIVE contract whose current shelf is there, empty
 * shelves included, ordered by shelf code (numeric-aware so K-2 comes before K-10). Four queries
 * however many shelves: contracts, stock, open pick-up requests, customers.
 */
export async function loadWarehouseStock(
  em: EntityManager,
  warehouseId: string,
): Promise<WarehouseShelfStockView[]> {
  const contracts = await findShelfContracts(em, {
    warehouseId,
    statuses: [ContractStatus.ACTIVE],
  });
  if (contracts.length === 0) return [];

  const contractIds = contracts.map((contract) => contract.id);
  const [stock, requests, customerRows] = await Promise.all([
    loadStock(em, contractIds),
    loadPickupRequests(em, { contractIds, open: true, order: 'requestedFor' }),
    em.query(
      `SELECT "id", "full_name" AS "fullName", "phone" FROM "app_users" WHERE "id" = ANY($1::uuid[])`,
      [[...new Set(contracts.map((contract) => contract.customerId))]],
    ) as Promise<ShelfPersonRef[]>,
  ]);
  const customers = new Map(customerRows.map((customer) => [customer.id, customer]));
  // A contract has at most one open request; the soonest wins if data ever says otherwise.
  const openRequests = new Map<string, PickupRequestView>();
  for (const request of requests) {
    if (!openRequests.has(request.contractId)) openRequests.set(request.contractId, request);
  }

  return contracts
    .map((contract): WarehouseShelfStockView => {
      const items = stock.get(contract.id) ?? [];
      return {
        contractId: contract.id,
        contractNo: contract.contractNo,
        contractStatus: contract.status,
        effectiveAt: contract.effectiveAt,
        shelf: contract.shelf,
        customer: customers.get(contract.customerId) ?? {
          id: contract.customerId,
          fullName: null,
          phone: null,
        },
        returnOpen: contract.returnOpen,
        items,
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
        openRequest: openRequests.get(contract.id) ?? null,
      };
    })
    .sort((a, b) => a.shelf.code.localeCompare(b.shelf.code, 'en', { numeric: true }));
}
