import type {
  ContractStatus,
  ShelfReceiptStatus,
  ShelfReceiptType,
  TicketStatus,
} from './domain.enums';
import type { PickupRequestView, ShelfItemView, ShelfPersonRef, ShelfRef } from './shelf-storage';

// Back-office views of shelf storage: stock per warehouse, receipt filters and receipt disputes.

/** Newest still-open (OPEN | ASSIGNED | IN_PROGRESS) service ticket linked to a receipt. */
export interface ShelfDisputeTicketRef {
  id: string;
  ticketNo: string;
  status: TicketStatus;
  subject: string;
  createdAt: string | Date;
}

/** Receipt summary carried by a service ticket. */
export interface ShelfReceiptRef {
  id: string;
  code: string;
  type: ShelfReceiptType;
  status: ShelfReceiptStatus;
}

/** One ACTIVE shelf contract in a warehouse, with its stock. */
export interface WarehouseShelfStockView {
  contractId: string;
  contractNo: string;
  contractStatus: ContractStatus;
  effectiveAt: string | Date;
  shelf: ShelfRef;
  customer: ShelfPersonRef;
  returnOpen: boolean;
  /** quantity > 0, name ASC; [] = rented but empty. */
  items: ShelfItemView[];
  totalQuantity: number;
  openRequest: PickupRequestView | null;
}

export interface WarehouseReceiptQuery {
  page?: number;
  /** At most 50. */
  limit?: number;
  /** Receipt code, customer name/phone or contract no (contains). */
  search?: string;
  type?: ShelfReceiptType;
  status?: ShelfReceiptStatus;
  /** Vietnam days YYYY-MM-DD, both inclusive. */
  from?: string;
  to?: string;
  /** true = only receipts with an open dispute ticket. */
  disputed?: boolean;
}
