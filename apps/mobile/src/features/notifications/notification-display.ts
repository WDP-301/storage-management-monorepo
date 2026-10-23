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

const KNOWN_TYPES: Record<NotificationType, NotificationDisplay> = {
  TICKET_CREATED: { label: 'Yêu cầu hỗ trợ', icon: 'ticket', tone: 'accent' },
  TICKET_UPDATED: { label: 'Yêu cầu hỗ trợ', icon: 'ticket', tone: 'accent' },
  TICKET_ASSIGNED: { label: 'Được phân công', icon: 'ticket', tone: 'warning' },
  INVOICE_ISSUED: { label: 'Hóa đơn', icon: 'invoice', tone: 'warning' },
  INVOICE_PAID: { label: 'Thanh toán', icon: 'paid', tone: 'success' },
  RETURN_FINALIZED: { label: 'Trả kho', icon: 'return', tone: 'accent' },
  SETTLEMENT_APPROVED: { label: 'Quyết toán', icon: 'settlement', tone: 'accent' },
  REFUND_COMPLETED: { label: 'Hoàn tiền', icon: 'refund', tone: 'success' },
  CONTRACT_TERM_ENDING: { label: 'Sắp hết hạn', icon: 'ending', tone: 'warning' },
  CONTRACT_OVERDUE: { label: 'Quá hạn', icon: 'overdue', tone: 'danger' },
  CHECK_OUT_MISSED: { label: 'Chưa check-out', icon: 'overdue', tone: 'warning' },
};

const FALLBACK_DISPLAY: NotificationDisplay = {
  label: 'Thông báo',
  icon: 'default',
  tone: 'neutral',
};

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
