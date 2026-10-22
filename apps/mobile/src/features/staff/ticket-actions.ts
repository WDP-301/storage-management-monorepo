import type { TicketStatus } from '@storage/types';

/**
 * Which processing steps the staff area offers for a ticket — pure so the rules are testable.
 * The API enforces the same rules; this only decides what buttons to show.
 *
 * Status literals are compared as strings (type-only import) so the module needs no runtime
 * bundle from `@storage/types`.
 */
export type TicketActionSet = {
  canStart: boolean;
  canResolve: boolean;
  canClose: boolean;
  /** Why nothing can be done yet, shown instead of the buttons; null when actions exist or the ticket is done. */
  hint: string | null;
};

const NONE: TicketActionSet = { canStart: false, canResolve: false, canClose: false, hint: null };

export function ticketActions(
  ticket: { status: TicketStatus; assigned_to: string | null },
  viewer: { userId: string | undefined; isManager: boolean },
): TicketActionSet {
  // Staff work tickets assigned to them; a manager may step in on any ticket the API listed.
  const isWorker = viewer.isManager || (!!viewer.userId && ticket.assigned_to === viewer.userId);

  switch (ticket.status) {
    case 'OPEN':
      return {
        ...NONE,
        hint: viewer.isManager
          ? 'Chưa phân công. Phân công nhân viên trên trang quản lý web.'
          : null,
      };
    case 'ASSIGNED':
      return isWorker ? { ...NONE, canStart: true, canClose: true } : NONE;
    case 'IN_PROGRESS':
      return isWorker ? { ...NONE, canResolve: true, canClose: true } : NONE;
    default:
      return NONE;
  }
}
