import { useRouter } from 'expo-router';
import { NotificationsScreen } from '../../src/features/notifications/NotificationsScreen';
import { notificationHref } from '../../src/features/notifications/notification-display';
import { useNotifications } from '../../src/features/notifications/use-notifications';

export default function NotificationsRoute() {
  const router = useRouter();
  const inbox = useNotifications();

  return (
    <NotificationsScreen
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
        const href = notificationHref(notification.data);
        if (href) router.navigate(href);
      }}
    />
  );
}
