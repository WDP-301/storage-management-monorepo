import type { NotificationType } from '@storage/types';
import { formatIsoDateTime } from '../../../lib/format-vi';

/** Vietnamese label, icon and colour per notification type; pure so the rules are testable. */

export type NotificationIconKey =
  | 'ticket'
  | 'invoice'
  | 'paid'
  | 'return'
  | 'settlement'
  | 'refund'
  | 'ending'
  | 'overdue'
  | 'default';

export type NotificationTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

export type NotificationDisplay = {
  label: string;
  icon: NotificationIconKey;
  tone: NotificationTone;
};

// Partial on purpose: a type this build does not know yet (newer server enum) falls through
// to FALLBACK_DISPLAY instead of breaking typecheck.
const KNOWN_TYPES: Partial<Record<NotificationType, NotificationDisplay>> = {
  TICKET_CREATED: { label: 'Yêu cầu hỗ trợ', icon: 'ticket', tone: 'accent' },
  TICKET_UPDATED: { label: 'Yêu cầu hỗ trợ', icon: 'ticket', tone: 'accent' },
  TICKET_ASSIGNED: { label: 'Được phân công', icon: 'ticket', tone: 'warning' },
  INVOICE_ISSUED: { label: 'Hóa đơn', icon: 'invoice', tone: 'warning' },
  INVOICE_PAID: { label: 'Thanh toán', icon: 'paid', tone: 'success' },
  BOOKING_DEPOSIT_PARTIAL: { label: 'Cọc chưa đủ', icon: 'invoice', tone: 'warning' },
  HANDOVER_ASSIGNED: { label: 'Bàn giao được gán', icon: 'ticket', tone: 'accent' },
  RETURN_ASSIGNED: { label: 'Nhận trả kho được gán', icon: 'return', tone: 'accent' },
  RETURN_REASSIGNED: { label: 'Trả kho chuyển người', icon: 'return', tone: 'warning' },
  CONTRACT_MAY_BE_ABANDONED: { label: 'Kho có thể bỏ hoang', icon: 'overdue', tone: 'danger' },
  CONTRACT_NO_SHOW: { label: 'Khách không đến nhận kho', icon: 'overdue', tone: 'warning' },
  CONTRACT_CANCELLED: { label: 'Hợp đồng bị hủy', icon: 'overdue', tone: 'danger' },
  RETURN_RESCHEDULED: { label: 'Lịch trả kho', icon: 'return', tone: 'warning' },
  RETURN_FINALIZED: { label: 'Trả kho', icon: 'return', tone: 'accent' },
  SETTLEMENT_APPROVED: { label: 'Quyết toán', icon: 'settlement', tone: 'accent' },
  REFUND_COMPLETED: { label: 'Hoàn tiền', icon: 'refund', tone: 'success' },
  CONTRACT_TERM_ENDING: { label: 'Sắp hết hạn', icon: 'ending', tone: 'warning' },
  CONTRACT_OVERDUE: { label: 'Quá hạn', icon: 'overdue', tone: 'danger' },
  CHECK_OUT_MISSED: { label: 'Chưa check-out', icon: 'overdue', tone: 'warning' },
  SHIFT_ASSIGNED: { label: 'Ca làm việc', icon: 'ending', tone: 'accent' },
  SHIFT_UPDATED: { label: 'Ca làm việc', icon: 'ending', tone: 'warning' },
  SHIFT_CANCELLED: { label: 'Hủy ca làm', icon: 'overdue', tone: 'danger' },
  SHELF_DROP_OFF: { label: 'Gửi đồ', icon: 'return', tone: 'accent' },
  SHELF_PICK_UP: { label: 'Lấy đồ', icon: 'return', tone: 'accent' },
  SHELF_RECEIPT_VOIDED: { label: 'Hủy phiếu', icon: 'overdue', tone: 'warning' },
  PICKUP_REQUEST_READY: { label: 'Đồ sẵn sàng', icon: 'paid', tone: 'success' },
  PICKUP_REQUEST_CREATED: { label: 'Yêu cầu lấy đồ', icon: 'ticket', tone: 'warning' },
  PICKUP_REQUEST_CANCELLED: { label: 'Hủy yêu cầu lấy đồ', icon: 'overdue', tone: 'warning' },
  DROP_OFF_REQUEST_CREATED: { label: 'Yêu cầu gửi đồ', icon: 'ticket', tone: 'warning' },
  DROP_OFF_REQUEST_CONFIRMED: { label: 'Kho sẵn sàng nhận đồ', icon: 'paid', tone: 'success' },
  DROP_OFF_REQUEST_CANCELLED: { label: 'Hủy yêu cầu gửi đồ', icon: 'overdue', tone: 'warning' },
  TOUR_APPOINTMENT_CREATED: { label: 'Lịch xem kho', icon: 'ticket', tone: 'accent' },
  TOUR_APPOINTMENT_CONFIRMED: { label: 'Xác nhận xem kho', icon: 'ticket', tone: 'success' },
  TOUR_APPOINTMENT_ASSIGNED: { label: 'Ca dẫn khách', icon: 'ticket', tone: 'warning' },
  TOUR_APPOINTMENT_CANCELLED: { label: 'Hủy lịch xem kho', icon: 'overdue', tone: 'danger' },
  UNIT_CHANGE_APPROVED: { label: 'Đổi kho được duyệt', icon: 'return', tone: 'success' },
  UNIT_CHANGE_REJECTED: { label: 'Đổi kho bị từ chối', icon: 'overdue', tone: 'danger' },
  UNIT_CHANGE_COMPLETED: { label: 'Đã đổi kho', icon: 'return', tone: 'success' },
  UNIT_CHANGE_CANCELLED: { label: 'Đổi kho bị huỷ', icon: 'overdue', tone: 'warning' },
  UNIT_CHANGE_MOVE_TODAY: { label: 'Hôm nay chuyển kho', icon: 'return', tone: 'warning' },
  UNIT_CHANGE_READY_FOR_FINAL_APPROVAL: {
    label: 'Chờ chốt đổi kho',
    icon: 'return',
    tone: 'warning',
  },
  MAINTENANCE_CHECK_DUE: { label: 'Cần kiểm tra kho cũ', icon: 'return', tone: 'warning' },
  MAINTENANCE_COMPLETED: { label: 'Đã kiểm tra kho cũ', icon: 'return', tone: 'success' },
};

const FALLBACK_DISPLAY: NotificationDisplay = {
  label: 'Thông báo',
  icon: 'default',
  tone: 'neutral',
};

/** Coarse buckets for the inbox filter — several event types share one filter chip. */
export type NotificationGroup =
  | 'payment'
  | 'contract'
  | 'unitChange'
  | 'storage'
  | 'schedule'
  | 'support'
  | 'other';

export const NOTIFICATION_GROUP_LABEL: Record<NotificationGroup, string> = {
  payment: 'Thanh toán',
  contract: 'Hợp đồng',
  unitChange: 'Đổi kho',
  storage: 'Gửi / lấy đồ',
  schedule: 'Lịch hẹn & ca',
  support: 'Hỗ trợ',
  other: 'Khác',
};

const GROUP_BY_TYPE: Partial<Record<NotificationType, NotificationGroup>> = {
  INVOICE_ISSUED: 'payment',
  INVOICE_PAID: 'payment',
  BOOKING_DEPOSIT_PARTIAL: 'payment',
  REFUND_COMPLETED: 'payment',
  HANDOVER_ASSIGNED: 'contract',
  RETURN_ASSIGNED: 'contract',
  RETURN_REASSIGNED: 'contract',
  CONTRACT_MAY_BE_ABANDONED: 'contract',
  CONTRACT_NO_SHOW: 'contract',
  CONTRACT_CANCELLED: 'contract',
  RETURN_RESCHEDULED: 'contract',
  RETURN_FINALIZED: 'contract',
  SETTLEMENT_APPROVED: 'contract',
  CONTRACT_TERM_ENDING: 'contract',
  CONTRACT_OVERDUE: 'contract',
  UNIT_CHANGE_APPROVED: 'unitChange',
  UNIT_CHANGE_REJECTED: 'unitChange',
  UNIT_CHANGE_COMPLETED: 'unitChange',
  UNIT_CHANGE_CANCELLED: 'unitChange',
  UNIT_CHANGE_MOVE_TODAY: 'unitChange',
  SHELF_DROP_OFF: 'storage',
  SHELF_PICK_UP: 'storage',
  SHELF_RECEIPT_VOIDED: 'storage',
  PICKUP_REQUEST_READY: 'storage',
  PICKUP_REQUEST_CREATED: 'storage',
  PICKUP_REQUEST_CANCELLED: 'storage',
  DROP_OFF_REQUEST_CREATED: 'storage',
  DROP_OFF_REQUEST_CONFIRMED: 'storage',
  DROP_OFF_REQUEST_CANCELLED: 'storage',
  CHECK_OUT_MISSED: 'storage',
  TOUR_APPOINTMENT_CREATED: 'schedule',
  TOUR_APPOINTMENT_CONFIRMED: 'schedule',
  TOUR_APPOINTMENT_ASSIGNED: 'schedule',
  TOUR_APPOINTMENT_CANCELLED: 'schedule',
  SHIFT_ASSIGNED: 'schedule',
  SHIFT_UPDATED: 'schedule',
  SHIFT_CANCELLED: 'schedule',
  TICKET_CREATED: 'support',
  TICKET_UPDATED: 'support',
  TICKET_ASSIGNED: 'support',
};

const GROUP_LOOKUP = new Map<string, NotificationGroup>(Object.entries(GROUP_BY_TYPE));

/** The filter bucket a type belongs to; newer server types land in `other`. */
export function notificationGroup(type: string): NotificationGroup {
  return GROUP_LOOKUP.get(type) ?? 'other';
}

// A Map, not a plain object lookup: a type string like "constructor" must not hit Object.prototype.
const DISPLAY_BY_TYPE = new Map<string, NotificationDisplay>(Object.entries(KNOWN_TYPES));

/** A type this build does not know (newer server) gets the generic look rather than failing. */
export function notificationDisplay(type: string): NotificationDisplay {
  return DISPLAY_BY_TYPE.get(type) ?? FALLBACK_DISPLAY;
}

function idOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Detail screens a notification can open, per app area — staff never land on customer routes. */
const TARGET_ROUTES = {
  customer: { contract: '/(customer)/contract-detail', ticket: '/(customer)/ticket-detail' },
  staff: { contract: '/(staff)/staff-contract', ticket: '/(staff)/staff-ticket' },
} as const;

export type NotificationArea = keyof typeof TARGET_ROUTES;

/**
 * Screen a notification opens: its contract, else its ticket; null when `data` points nowhere
 * (e.g. an invoice notification), in which case tapping only marks it read.
 */
export function notificationHref(
  data: Record<string, unknown>,
  area: NotificationArea = 'customer',
): string | null {
  const routes = TARGET_ROUTES[area];
  const contractId = idOf(data.contractId);
  if (contractId) return `${routes.contract}?id=${encodeURIComponent(contractId)}`;
  const ticketId = idOf(data.ticketId);
  if (ticketId) return `${routes.ticket}?id=${encodeURIComponent(ticketId)}`;
  const tourAppointmentId = idOf(data.tourAppointmentId);
  if (tourAppointmentId) {
    return area === 'staff'
      ? `/(staff)/staff-tour?id=${encodeURIComponent(tourAppointmentId)}`
      : '/(customer)/tours';
  }
  return null;
}

/** "5 phút trước" within the last week, then the full local date; empty for an invalid timestamp. */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return '';
  // A device clock slightly behind the server yields a negative gap; treat it as "just now".
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return formatIsoDateTime(iso);
}
