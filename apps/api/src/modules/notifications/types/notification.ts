import type { Notification } from '@entities/notification.entity';
import type { NotificationStatus, NotificationType, PaginationMeta } from '@storage/types';

/** What a feature hands to NotificationsService to notify one or more users. */
export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  /** Context for the client (ids to deep-link to, what changed, …). */
  data?: Record<string, unknown>;
}

/** The `notifications` row exposed with its raw column names (same style as service tickets). */
export interface NotificationRecord {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  status: NotificationStatus;
  sent_at: string | Date | null;
  read_at: string | Date | null;
  created_at: string | Date;
}

export interface NotificationResponse {
  notification: NotificationRecord;
}

export interface NotificationListResponse {
  notifications: NotificationRecord[];
  meta: PaginationMeta;
}

export interface NotificationUnreadCountResponse {
  unread: number;
}

export interface NotificationMarkAllReadResponse {
  updated: number;
}

export function toNotificationRecord(row: Notification): NotificationRecord {
  return {
    id: row.id,
    user_id: row.userId,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    data: row.data ?? {},
    status: row.status,
    sent_at: row.sentAt ?? null,
    read_at: row.readAt ?? null,
    created_at: row.createdAt,
  };
}
