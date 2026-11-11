import type {
  EvidenceFile,
  ShelfReceiptLineView,
  ShelfReceiptStatus,
  ShelfReceiptType,
  ShelfReceiptView,
  TicketStatus,
} from '@storage/types';

export interface RawReceipt {
  id: string;
  code: string;
  type: ShelfReceiptType;
  status: ShelfReceiptStatus;
  contractId: string;
  contractNo: string;
  shelfId: string;
  shelfCode: string;
  shelfName: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  facilityId: string;
  facilityCode: string;
  facilityName: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  performedById: string | null;
  performedByName: string | null;
  createdAt: Date;
  note: string | null;
  photos: EvidenceFile[];
  pickupRequestId: string | null;
  dropOffRequestId: string | null;
  recovered: boolean;
  voidedAt: Date | null;
  voidedById: string | null;
  voidedByName: string | null;
  voidReason: string | null;
  disputeId: string | null;
  disputeTicketNo: string | null;
  disputeStatus: TicketStatus | null;
  disputeSubject: string | null;
  disputeCreatedAt: Date | null;
}

const staffRef = (id: string | null, fullName: string | null) =>
  id ? { id, fullName: fullName ?? '' } : null;

/** One joined receipt row plus its lines as the API view. */
export function toReceiptView(row: RawReceipt, lines: ShelfReceiptLineView[]): ShelfReceiptView {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    status: row.status,
    contractId: row.contractId,
    contractNo: row.contractNo,
    shelf: { id: row.shelfId, code: row.shelfCode, name: row.shelfName },
    warehouse: { id: row.warehouseId, code: row.warehouseCode, name: row.warehouseName },
    facility: { id: row.facilityId, code: row.facilityCode, name: row.facilityName },
    customer: { id: row.customerId, fullName: row.customerName, phone: row.customerPhone },
    performedBy: staffRef(row.performedById, row.performedByName),
    createdAt: row.createdAt,
    note: row.note,
    photos: row.photos ?? [],
    lines,
    pickupRequestId: row.pickupRequestId,
    dropOffRequestId: row.dropOffRequestId,
    recovered: row.recovered,
    void: row.voidedAt
      ? {
          at: row.voidedAt,
          by: staffRef(row.voidedById, row.voidedByName),
          reason: row.voidReason ?? '',
        }
      : null,
    openDisputeTicket:
      row.disputeId && row.disputeTicketNo && row.disputeStatus && row.disputeCreatedAt
        ? {
            id: row.disputeId,
            ticketNo: row.disputeTicketNo,
            status: row.disputeStatus,
            subject: row.disputeSubject ?? '',
            createdAt: row.disputeCreatedAt,
          }
        : null,
  };
}
