import { Button } from 'heroui-native';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import type { NotificationRecord } from '../../types/notification-api';
import { NotificationRow } from './NotificationRow';

type Props = {
  notifications: NotificationRecord[];
  unread: number;
  error: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  isMarkingAll: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  onOpen: (notification: NotificationRecord) => void;
  onMarkAllRead: () => void;
};

export function NotificationsScreen({
  notifications,
  unread,
  error,
  hasMore,
  isLoading,
  isRefreshing,
  isLoadingMore,
  isMarkingAll,
  onRefresh,
  onLoadMore,
  onOpen,
  onMarkAllRead,
}: Props) {
  return (
    <FlatList
      data={notifications}
      keyExtractor={(notification) => notification.id}
      renderItem={({ item }) => (
        <NotificationRow notification={item} onPress={() => onOpen(item)} />
      )}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.4}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View className="gap-3 pb-1 pt-5">
          <View>
            <Text className="font-strong text-foreground text-title-md">Thông báo</Text>
            <Text className="font-body mt-1 text-body-sm text-muted">
              Cập nhật về hợp đồng, hóa đơn và yêu cầu hỗ trợ
            </Text>
          </View>

          {error ? (
            <View className="rounded-xl border border-danger/30 bg-danger-bg p-3">
              <Text className="font-body text-body-sm text-danger">{error}</Text>
              <Button className="mt-3" size="sm" variant="secondary" onPress={onRefresh}>
                <Button.Label className="font-ui">Thử lại</Button.Label>
              </Button>
            </View>
          ) : null}

          {unread > 0 ? (
            <View className="flex-row items-center justify-between gap-3">
              <Text className="font-ui text-body-sm text-foreground">{unread} chưa đọc</Text>
              <Button
                size="sm"
                variant="secondary"
                isDisabled={isMarkingAll}
                onPress={onMarkAllRead}
              >
                <Button.Label className="font-ui">Đánh dấu tất cả đã đọc</Button.Label>
              </Button>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator className="py-10" />
        ) : error ? null : (
          <View className="items-center gap-2 rounded-2xl border border-border border-dashed px-5 py-10">
            <Text className="font-strong text-body-md text-foreground">Chưa có thông báo</Text>
            <Text className="font-body text-center text-body-sm text-muted">
              Thông báo về hợp đồng, hóa đơn và hoàn tiền sẽ xuất hiện ở đây.
            </Text>
          </View>
        )
      }
      ListFooterComponent={
        isLoadingMore ? (
          <ActivityIndicator className="py-3" />
        ) : !hasMore && notifications.length > 0 ? (
          <Text className="font-body pt-2 text-center text-caption text-muted">
            Đã hiển thị hết thông báo.
          </Text>
        ) : null
      }
    />
  );
}
