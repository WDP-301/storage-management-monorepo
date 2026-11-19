/** Where a back-office notification leads on the web; pure so the routing rules are testable. */

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const contractsSearch = (contractNo: string | null, extra = ''): string =>
  contractNo ? `/contracts?search=${encodeURIComponent(contractNo)}${extra}` : '/contracts';

/** The page a notification opens, or null when it points nowhere on the web. */
export function notificationTarget(type: string, data: Record<string, unknown>): string | null {
  const contractNo = text(data.contractNo);
  switch (type) {
    case 'BOOKING_NEEDS_REFUND':
      return '/admin/sepay-transfers';
    case 'SETTLEMENT_PENDING_APPROVAL':
      return contractsSearch(contractNo, '&settlement=pending');
    case 'CONTRACT_REFUND_PENDING':
      return contractsSearch(contractNo, '&settlement=awaiting_refund');
    case 'CONTRACT_RENEWAL_REQUESTED':
      return '/contract-renewals';
    case 'INVOICE_OVERDUE_ALERT':
    case 'CONTRACT_OVERDUE':
    case 'CONTRACT_NO_SHOW':
    case 'CONTRACT_MAY_BE_ABANDONED':
      return contractsSearch(contractNo);
    case 'TICKET_CREATED':
    case 'TICKET_UPDATED':
    case 'TICKET_ASSIGNED':
      return '/facility-manager/tickets';
    case 'TOUR_APPOINTMENT_CREATED':
    case 'TOUR_APPOINTMENT_CONFIRMED':
    case 'TOUR_APPOINTMENT_ASSIGNED':
    case 'TOUR_APPOINTMENT_CANCELLED':
      return '/facility-manager/tour-appointments';
    default:
      return type.startsWith('UNIT_CHANGE_') ? '/facility-manager' : null;
  }
}

/** "5 phút trước" within a week, then the local date; empty for an invalid timestamp. */
export function formatNotificationTime(iso: string, now: number = Date.now()): string {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return '';
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}
