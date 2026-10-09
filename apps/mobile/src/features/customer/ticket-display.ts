import { TicketPriority, TicketStatus } from '@storage/types';

/** Vietnamese labels + chip colours shared by the ticket list, detail, and create screens. */

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: 'Mới tạo',
  [TicketStatus.ASSIGNED]: 'Đã phân công',
  [TicketStatus.IN_PROGRESS]: 'Đang xử lý',
  [TicketStatus.RESOLVED]: 'Đã xử lý',
  [TicketStatus.CLOSED]: 'Đã đóng',
  [TicketStatus.CANCELLED]: 'Đã hủy',
};

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  [TicketPriority.LOW]: 'Thấp',
  [TicketPriority.NORMAL]: 'Bình thường',
  [TicketPriority.HIGH]: 'Cao',
  [TicketPriority.URGENT]: 'Khẩn cấp',
};

type ChipColor = 'accent' | 'default' | 'success' | 'warning' | 'danger';

export const TICKET_STATUS_COLOR: Record<TicketStatus, ChipColor> = {
  [TicketStatus.OPEN]: 'accent',
  [TicketStatus.ASSIGNED]: 'warning',
  [TicketStatus.IN_PROGRESS]: 'warning',
  [TicketStatus.RESOLVED]: 'success',
  [TicketStatus.CLOSED]: 'default',
  [TicketStatus.CANCELLED]: 'default',
};

/** Statuses the owner can still cancel — mirrors the server's ASSIGNABLE_STATUSES rule. */
export const CANCELLABLE_STATUSES: readonly TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
];
