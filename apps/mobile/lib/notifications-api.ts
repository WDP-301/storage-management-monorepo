import type { NotificationListResponse, NotificationRecord } from '../src/types/notification-api';
import { request } from './api';

/** `data` is free-form jsonb server-side; callers read keys off it, so it must be an object. */
function normaliseRecord(record: NotificationRecord): NotificationRecord {
  const data: unknown = record.data;
  const isObject = typeof data === 'object' && data !== null && !Array.isArray(data);
  return isObject ? record : { ...record, data: {} };
}

export const NotificationsApi = {
  /** Newest first; the server's default page size applies. */
  list: async (
    page: number,
    unreadOnly = false,
    signal?: AbortSignal,
  ): Promise<NotificationListResponse> => {
    const search = new URLSearchParams({ page: String(page) });
    if (unreadOnly) search.set('unreadOnly', 'true');
    const response = await request<NotificationListResponse>(`/notifications?${search}`, {
      signal,
    });
    return { ...response, notifications: response.notifications.map(normaliseRecord) };
  },

  unreadCount: async (signal?: AbortSignal): Promise<number> => {
    const { unread } = await request<{ unread: number }>('/notifications/unread-count', {
      signal,
    });
    return Number.isFinite(unread) ? Math.max(0, Math.trunc(unread)) : 0;
  },

  markRead: async (id: string): Promise<NotificationRecord> =>
    normaliseRecord(
      (
        await request<{ notification: NotificationRecord }>(
          `/notifications/${encodeURIComponent(id)}/read`,
          { method: 'PATCH' },
        )
      ).notification,
    ),

  /** Resolves with how many notifications flipped to read. */
  markAllRead: async (): Promise<number> =>
    (await request<{ updated: number }>('/notifications/read-all', { method: 'PATCH' })).updated,
};
