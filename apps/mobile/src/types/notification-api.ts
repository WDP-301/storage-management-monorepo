import type { NotificationStatus, PaginationMeta } from '@storage/types';

/**
 * Mirrors the API's NotificationRecord — snake_case field names are the wire contract.
 *
 * `type` stays a plain string: the server can ship a type this build does not know yet, and the
 * display layer falls back to a generic look instead of failing.
 */
export type NotificationRecord = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  /** Context for deep links (`contractId`, `ticketId`, …); always an object after normalisation. */
  data: Record<string, unknown>;
  status: NotificationStatus;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationListResponse = {
  notifications: NotificationRecord[];
  meta: PaginationMeta;
};
