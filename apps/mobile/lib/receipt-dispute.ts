import type { ShelfReceiptView } from '@storage/types';
import type {
  TicketFacilityOption,
  TicketFormOptions,
  TicketTypeInfo,
} from '../src/types/ticket-api';

/** Rules for reporting a wrong shelf receipt through the ticket form; pure so they are testable. */

const SUPPORT_CODE = 'SUPPORT';

type DisputeReceipt = Pick<ShelfReceiptView, 'status' | 'openDisputeTicket'>;

/** Offer the report action only on a live receipt nobody has reported yet; the API re-checks. */
export const canReportReceipt = (receipt: DisputeReceipt): boolean =>
  receipt.status === 'ACTIVE' && !receipt.openDisputeTicket;

export const disputeSubject = (code: string): string => `Báo sai phiếu ${code}`;

const pad = (value: number) => String(value).padStart(2, '0');

/** Seeds the description so staff see which receipt and which entry the customer means. */
export function disputeDescription(
  receipt: Pick<ShelfReceiptView, 'code' | 'type' | 'shelf' | 'createdAt'>,
): string {
  const at = new Date(String(receipt.createdAt));
  const when = Number.isNaN(at.getTime())
    ? ''
    : ` · ${pad(at.getDate())}/${pad(at.getMonth() + 1)}/${at.getFullYear()} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
  const kind = receipt.type === 'DROP_OFF' ? 'Gửi đồ' : 'Lấy đồ';
  return `Phiếu ${receipt.code} (${kind} · kệ ${receipt.shelf.code}${when}) bị ghi sai:\n`;
}

/**
 * The receipt's facility as the only choice. The regular options only list facilities with a
 * current rental window, which an overstaying or purged contract may no longer have.
 */
export function disputeFormOptions(
  options: TicketFormOptions,
  receipt: Pick<ShelfReceiptView, 'facility'>,
): TicketFormOptions {
  const facility: TicketFacilityOption = {
    id: receipt.facility.id,
    code: receipt.facility.code,
    name: receipt.facility.name,
    units: [],
    typeIds: options.types.map((type) => type.id),
  };
  return { types: options.types, facilities: [facility] };
}

export const supportTypeId = (types: TicketTypeInfo[]): string | null =>
  types.find((type) => type.code === SUPPORT_CODE)?.id ?? null;

/** Why a loaded receipt cannot be reported; null when it can. */
export function receiptBlockedMessage(
  receipt: Pick<ShelfReceiptView, 'status' | 'openDisputeTicket'>,
): string | null {
  if (canReportReceipt(receipt)) return null;
  if (receipt.status === 'VOIDED') return 'Phiếu đã bị hủy, không cần báo sai.';
  const ticketNo = receipt.openDisputeTicket?.ticketNo;
  return `Phiếu này đã được báo sai${ticketNo ? ` (${ticketNo})` : ''}, đang chờ xử lý.`;
}

type ErrorLike = { statusCode?: number; message?: string; details?: unknown };

/** True when the API refused because the receipt itself can no longer be reported. */
export function isDisputeEnding(err: unknown): boolean {
  const e = (err ?? {}) as ErrorLike;
  const reason = ((e.details ?? {}) as { reason?: string }).reason;
  return e.statusCode === 404 || reason === 'RECEIPT_VOIDED' || reason === 'OPEN_DISPUTE_EXISTS';
}

/** Vietnamese wording for the refusals the ticket API gives when the linked receipt is not valid. */
export function disputeErrorMessage(err: unknown): string {
  const e = (err ?? {}) as ErrorLike;
  const details = (e.details ?? {}) as { reason?: string; ticketNo?: string };
  if (e.statusCode === 404) return 'Không tìm thấy phiếu này.';
  if (details.reason === 'RECEIPT_VOIDED') return 'Phiếu đã bị hủy, không cần báo sai.';
  if (details.reason === 'OPEN_DISPUTE_EXISTS') {
    return `Phiếu này đã được báo sai${details.ticketNo ? ` (${details.ticketNo})` : ''}, đang chờ xử lý.`;
  }
  return e.message || 'Không gửi được yêu cầu. Thử lại.';
}
