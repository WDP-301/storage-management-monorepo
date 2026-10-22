import { useRouter } from 'expo-router';
import { NotificationsScreen } from './NotificationsScreen';
import { type NotificationArea, notificationHref } from './notification-display';
import { useNotifications } from './use-notifications';

/** The session user's inbox; `area` decides which detail screens a tapped notification opens. */
export function NotificationsInbox({ area }: { area: NotificationArea }) {
  const router = useRouter();
  const inbox = useNotifications();

  return (
    <NotificationsScreen
      subtitle={
        area === 'staff'
          ? 'Yêu cầu được phân công và cập nhật tại chi nhánh'
          : 'Cập nhật về hợp đồng, hóa đơn và yêu cầu hỗ trợ'
      }
      notifications={inbox.items}
      unread={inbox.unread}
      error={inbox.error}
      hasMore={inbox.hasMore}
      isLoading={inbox.isLoading}
      isRefreshing={inbox.isRefreshing}
      isLoadingMore={inbox.isLoadingMore}
      isMarkingAll={inbox.isMarkingAll}
      onRefresh={inbox.refresh}
      onLoadMore={inbox.loadMore}
      onMarkAllRead={() => void inbox.markAllRead()}
      onOpen={(notification) => {
        void inbox.markRead(notification.id);
        const href = notificationHref(notification.data, area);
        if (href) router.navigate(href);
      }}
    />
  );
}
