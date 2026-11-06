import type {
  DropOffBlockReason,
  PickUpBlockReason,
  PickupRequestBlockReason,
  PickupRequestStatus,
  ShelfReceiptType,
} from '@storage/types';
import { formatIsoDateTime } from './format-vi';

/** Vietnamese wording for shelf storage; pure so the rules are testable. */

const RECEIPT_TYPE_LABEL: Record<ShelfReceiptType, string> = {
  DROP_OFF: 'Phiếu gửi đồ',
  PICK_UP: 'Phiếu lấy đồ',
};
export const receiptTypeLabel = (type: ShelfReceiptType): string =>
  RECEIPT_TYPE_LABEL[type] ?? 'Phiếu';

const PICKUP_STATUS_LABEL: Record<PickupRequestStatus, string> = {
  PENDING: 'Chờ chuẩn bị',
  READY: 'Đã sẵn sàng',
  COMPLETED: 'Đã lấy',
  CANCELLED: 'Đã hủy',
};
export const pickupStatusLabel = (status: PickupRequestStatus): string =>
  PICKUP_STATUS_LABEL[status] ?? status;

/** Badge on a receipt a manager recorded without the customer, on an abandoned shelf. */
export const recoveredLabel = 'Thu hồi (khách bỏ kệ)';

const DROP_OFF_BLOCK: Record<DropOffBlockReason, string> = {
  CONTRACT_NOT_STARTED: 'Hợp đồng chưa bắt đầu',
  INVOICE_OVERDUE: 'Khách còn hóa đơn quá hạn',
};
export const dropOffBlockLabel = (reason: DropOffBlockReason): string =>
  DROP_OFF_BLOCK[reason] ?? 'Chưa thể nhận đồ';

const PICK_UP_BLOCK: Record<PickUpBlockReason, string> = {
  NO_STOCK: 'Kệ đang trống',
  INVOICE_OVERDUE: 'Khách còn hóa đơn quá hạn',
};
export const pickUpBlockLabel = (reason: PickUpBlockReason): string =>
  PICK_UP_BLOCK[reason] ?? 'Chưa thể trả đồ';

const PICKUP_REQUEST_BLOCK: Record<PickupRequestBlockReason, string> = {
  CONTRACT_NOT_ACTIVE: 'Hợp đồng không còn hiệu lực',
  OPEN_REQUEST_EXISTS: 'Bạn đã có một yêu cầu lấy đồ đang chờ',
  NO_STOCK: 'Kệ đang trống',
  INVOICE_OVERDUE: 'Thanh toán hóa đơn quá hạn để lấy đồ',
};
export const pickupRequestBlockLabel = (reason: PickupRequestBlockReason): string =>
  PICKUP_REQUEST_BLOCK[reason] ?? 'Chưa thể tạo yêu cầu lấy đồ';

type NamedQuantity = { name: string; quantity: number };

/** `Sách ×2, Chăn ×1 và 3 món khác`: the first lines, then how many more there are. */
export function linesSummary(lines: readonly NamedQuantity[], max = 3): string {
  const shown = lines.slice(0, max).map((line) => `${line.name} ×${line.quantity}`);
  const rest = lines.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} và ${rest} món khác` : shown.join(', ');
}

export const totalQuantity = (lines: readonly { quantity: number }[]): number =>
  lines.reduce((sum, line) => sum + line.quantity, 0);

/** Whole seconds from `nowMs` to `deadlineMs` (device-clock ms), never negative. */
export function secondsUntil(deadlineMs: number, nowMs: number): number {
  return Number.isFinite(deadlineMs) ? Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000)) : 0;
}

type Details = Record<string, unknown> | undefined;

function itemList(
  details: Details,
  key: string,
  render: (item: Record<string, unknown>) => string,
) {
  const items = details?.[key];
  if (!Array.isArray(items)) return '';
  return items
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map(render)
    .join(', ');
}

const reasonOf = (details: Details): string | undefined =>
  typeof details?.reason === 'string' ? details.reason : undefined;

function effectiveDate(details: Details): string {
  const at = details?.effectiveAt;
  return typeof at === 'string' ? formatIsoDateTime(at) : '';
}

const FIELD_ERROR: Record<string, string> = {
  lineShape: 'Mỗi dòng đồ cần tên hoặc món đã có, kèm số lượng từ 1 trở lên.',
  duplicateLine: 'Có món bị nhập trùng, hãy gộp thành một dòng.',
  notOwnUpload: 'Ảnh không hợp lệ, hãy chụp lại ảnh rồi thử lại.',
  required: 'Cần ít nhất một ảnh.',
  notAllowed: 'Phiếu gửi đồ không thể gắn với yêu cầu lấy đồ.',
  outOfRange: 'Thời gian lấy đồ phải trong vòng 30 ngày tới.',
};

/**
 * Message for an API error of the shelf storage flows. `fallback` is used for codes this build
 * does not know, and is the server's own text for SHELF_NOT_EMPTY, whose message already says
 * how many items remain.
 */
export function shelfErrorMessage(
  code: string | undefined,
  details: Details,
  fallback: string,
): string {
  const reason = reasonOf(details);
  switch (code) {
    case 'ACCESS_PASS_INVALID':
      if (reason === 'MALFORMED') return 'Đây không phải mã gửi / lấy đồ.';
      if (reason === 'NOT_FOUND') return 'Không tìm thấy mã này. Nhờ khách tải lại mã.';
      if (reason === 'USED') {
        return details?.verifiedByMe === true
          ? 'Mã này bạn đã quét rồi. Mở lại phiên đang làm việc.'
          : 'Mã này đã được dùng. Nhờ khách tải mã mới.';
      }
      if (reason === 'EXPIRED') return 'Mã đã hết hạn. Nhờ khách tải mã mới.';
      return fallback;
    case 'CHECK_IN_NOT_ALLOWED':
      if (reason === 'NO_SHELF_CONTRACT') return 'Khách không thuê kệ nào ở kho này.';
      if (reason === 'CONTRACT_NOT_STARTED') {
        const date = effectiveDate(details);
        return date ? `Hợp đồng chưa bắt đầu (từ ${date}).` : 'Hợp đồng chưa bắt đầu.';
      }
      return fallback;
    case 'INVOICE_OVERDUE': {
      const nos = Array.isArray(details?.invoiceNos) ? details.invoiceNos.join(', ') : '';
      return nos ? `Còn hóa đơn quá hạn: ${nos}.` : 'Còn hóa đơn quá hạn.';
    }
    case 'COUNTER_SESSION_INVALID':
      if (reason === 'EXPIRED') return 'Phiên làm việc đã hết hạn. Quét lại mã của khách.';
      if (reason === 'WRONG_CUSTOMER') return 'Hợp đồng này không thuộc khách đang làm việc.';
      if (reason === 'WRONG_WAREHOUSE') return 'Hợp đồng này không ở kho đang làm việc.';
      return 'Không tìm thấy phiên làm việc. Quét lại mã của khách.';
    case 'SHELF_RECEIPT_NOT_ALLOWED':
      if (reason === 'CONTRACT_NOT_ACTIVE') return 'Hợp đồng không còn hiệu lực.';
      if (reason === 'CONTRACT_NOT_STARTED') {
        const date = effectiveDate(details);
        return date ? `Hợp đồng chưa bắt đầu (từ ${date}).` : 'Hợp đồng chưa bắt đầu.';
      }
      if (reason === 'PICKUP_REQUEST_MISMATCH') return 'Yêu cầu lấy đồ không còn khớp với kệ này.';
      if (reason === 'ITEM_NOT_IN_CONTRACT') return 'Có món không thuộc kệ của khách.';
      if (reason === 'CLIENT_REQUEST_REUSED')
        return 'Phiếu này đã được lưu cho kệ khác. Tạo phiếu mới.';
      if (reason === 'NOT_ABANDONED_RETURN')
        return 'Chỉ thu hồi được kệ có yêu cầu trả do khách bỏ kệ.';
      return fallback;
    case 'SHELF_STOCK_INSUFFICIENT': {
      const list = itemList(
        details,
        'items',
        (item) => `${item.name} (cần ${item.requested}, còn ${item.available})`,
      );
      const lead = reason === 'VOID' ? 'Không hủy được phiếu vì kệ không đủ đồ' : 'Kệ không đủ đồ';
      return list ? `${lead}: ${list}.` : `${lead}.`;
    }
    case 'PICKUP_REQUEST_NOT_ALLOWED':
      if (reason === 'CONTRACT_NOT_ACTIVE') return 'Hợp đồng không còn hiệu lực.';
      if (reason === 'OPEN_REQUEST_EXISTS') return 'Đã có một yêu cầu lấy đồ đang chờ.';
      if (reason === 'NO_STOCK') return 'Kệ đang trống.';
      if (reason === 'QUANTITY_EXCEEDS_STOCK') {
        const list = itemList(details, 'items', (item) => `${item.name} (còn ${item.available})`);
        return list ? `Số lượng vượt quá đồ trên kệ: ${list}.` : 'Số lượng vượt quá đồ trên kệ.';
      }
      if (reason === 'ITEM_NOT_IN_CONTRACT') return 'Có món không còn trên kệ.';
      if (reason === 'NOT_PENDING') return 'Yêu cầu này đã được xử lý.';
      if (reason === 'NOT_OPEN') return 'Yêu cầu này đã đóng.';
      return fallback;
    case 'SHELF_NOT_EMPTY':
      return fallback;
    case 'CONFLICT':
      return reason === 'ALREADY_VOIDED' ? 'Phiếu này đã được hủy trước đó.' : fallback;
    case 'VALIDATION_FAILED': {
      const fields = details?.fields;
      if (!Array.isArray(fields)) return fallback;
      for (const field of fields) {
        const fieldCode = (field as { code?: unknown } | null)?.code;
        if (typeof fieldCode === 'string' && FIELD_ERROR[fieldCode]) return FIELD_ERROR[fieldCode];
      }
      return fallback;
    }
    default:
      return fallback;
  }
}
