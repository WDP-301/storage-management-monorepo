import {
  DropOffRequestStatus,
  PickupRequestStatus,
  type ShelfReceiptLineView,
  ShelfReceiptStatus,
  ShelfReceiptType,
  TicketStatus,
  type WarehouseReceiptQuery,
} from '@storage/types';
import type { ApiError } from '../../lib/api';

export const RECEIPT_TYPE_LABEL: Record<ShelfReceiptType, string> = {
  [ShelfReceiptType.DROP_OFF]: 'Gửi đồ',
  [ShelfReceiptType.PICK_UP]: 'Lấy đồ',
};

export const RECEIPT_STATUS_LABEL: Record<ShelfReceiptStatus, string> = {
  [ShelfReceiptStatus.ACTIVE]: 'Hiệu lực',
  [ShelfReceiptStatus.VOIDED]: 'Đã hủy',
};

export const PICKUP_REQUEST_STATUS_LABEL: Record<PickupRequestStatus, string> = {
  [PickupRequestStatus.PENDING]: 'Chờ chuẩn bị',
  [PickupRequestStatus.READY]: 'Đã chuẩn bị',
  [PickupRequestStatus.COMPLETED]: 'Đã hoàn tất',
  [PickupRequestStatus.CANCELLED]: 'Đã hủy',
};

export const DROP_OFF_REQUEST_STATUS_LABEL: Record<DropOffRequestStatus, string> = {
  [DropOffRequestStatus.PENDING]: 'Chờ xác nhận',
  [DropOffRequestStatus.CONFIRMED]: 'Đã xác nhận',
  [DropOffRequestStatus.COMPLETED]: 'Đã gửi',
  [DropOffRequestStatus.CANCELLED]: 'Đã hủy',
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: 'Mới',
  [TicketStatus.ASSIGNED]: 'Đã phân công',
  [TicketStatus.IN_PROGRESS]: 'Đang xử lý',
  [TicketStatus.RESOLVED]: 'Đã xử lý',
  [TicketStatus.CLOSED]: 'Đã đóng',
  [TicketStatus.CANCELLED]: 'Đã hủy',
};

export const VOID_REASON_MIN = 3;
export const VOID_REASON_MAX = 500;

/** `Tên ×n` for the first `max` lines, then "và k món khác". */
export function summarizeLines(
  lines: Pick<ShelfReceiptLineView, 'name' | 'quantity'>[],
  max = 3,
): string {
  if (lines.length === 0) return '—';
  const head = lines.slice(0, max).map((line) => `${line.name} ×${line.quantity}`);
  const rest = lines.length - head.length;
  return rest > 0 ? `${head.join(', ')} và ${rest} món khác` : head.join(', ');
}

export interface ReceiptFilterState {
  search: string;
  type: '' | ShelfReceiptType;
  from: string;
  to: string;
  /** On = voided receipts are listed too (no status filter sent). */
  includeVoided: boolean;
  disputedOnly: boolean;
}

export const EMPTY_RECEIPT_FILTERS: ReceiptFilterState = {
  search: '',
  type: '',
  from: '',
  to: '',
  includeVoided: true,
  disputedOnly: false,
};

export function buildReceiptQuery(
  filters: ReceiptFilterState,
  page: number,
  limit = 20,
): WarehouseReceiptQuery {
  const query: WarehouseReceiptQuery = { page, limit };
  const search = filters.search.trim();
  if (search) query.search = search;
  if (filters.type) query.type = filters.type;
  if (filters.from) query.from = filters.from;
  if (filters.to) query.to = filters.to;
  if (!filters.includeVoided) query.status = ShelfReceiptStatus.ACTIVE;
  if (filters.disputedOnly) query.disputed = true;
  return query;
}

interface StockShortItem {
  name?: unknown;
  requested?: unknown;
  available?: unknown;
}

/** Vietnamese message for a refused void; falls back to the server text for anything unmapped. */
export function describeVoidError(err: unknown): string {
  const e = err as Partial<ApiError> | null;
  const reason = typeof e?.details?.reason === 'string' ? e.details.reason : undefined;
  if (e?.code === 'SHELF_STOCK_INSUFFICIENT') {
    const items = Array.isArray(e.details?.items) ? (e.details.items as StockShortItem[]) : [];
    const list = items
      .map((i) => `${String(i.name)}: còn ${Number(i.available)}, cần ${Number(i.requested)}`)
      .join('; ');
    return `Không thể hủy vì kệ không còn đủ đồ để hoàn lại${list ? ` (${list})` : ''}.`;
  }
  if (e?.code === 'CONFLICT' && reason === 'ALREADY_VOIDED')
    return 'Phiếu này đã được hủy trước đó.';
  if (e?.code === 'SHELF_RECEIPT_NOT_ALLOWED' && reason === 'CONTRACT_NOT_ACTIVE') {
    return 'Hợp đồng không còn hiệu lực nên không thể hủy phiếu.';
  }
  if (e?.status === 403) return 'Bạn không quản lý cơ sở này.';
  return e?.message || 'Không thể hủy phiếu. Vui lòng thử lại.';
}

/** Message for a failed read of stock, receipts or requests. */
export function describeLoadError(err: unknown): string {
  const e = err as Partial<ApiError> | null;
  if (e?.status === 403) return 'Bạn không quản lý cơ sở này.';
  return e?.message || 'Không thể tải dữ liệu. Vui lòng thử lại.';
}
