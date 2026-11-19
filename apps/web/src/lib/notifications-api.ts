import type { NotificationType } from '@storage/types';
import { apiClient } from './api';

export interface NotificationRecord {
  id: string;
  type: NotificationType | string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export const NotificationsApi = {
  list: async (limit = 20): Promise<NotificationRecord[]> => {
    const res = await apiClient.get<ApiEnvelope<{ notifications: NotificationRecord[] }>>(
      '/notifications',
      { params: { limit } },
    );
    return res.data.data.notifications;
  },

  unreadCount: async (): Promise<number> => {
    const res = await apiClient.get<ApiEnvelope<{ unread: number }>>('/notifications/unread-count');
    return res.data.data.unread;
  },

  markRead: async (id: string): Promise<void> => {
    await apiClient.patch(`/notifications/${id}/read`);
  },

  markAllRead: async (): Promise<void> => {
    await apiClient.patch('/notifications/read-all');
  },
};
