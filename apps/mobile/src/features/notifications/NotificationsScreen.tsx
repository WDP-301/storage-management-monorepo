import { CaretLeft, CaretRight } from 'phosphor-react-native';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import {
  Button,
  type CardTabItem,
  CardTabs,
  colors,
  FlowScreen,
  InlineMessage,
  TabChip,
  Text,
} from '../../components/ui';
import type { NotificationRecord } from '../../types/notification-api';
import { NotificationRow } from './NotificationRow';
import {
  NOTIFICATION_GROUP_LABEL,
  type NotificationGroup,
  notificationGroup,
} from './notification-display';

type Props = {
  subtitle: string;
  notifications: NotificationRecord[];
  unread: number;
  error: string | null;
  page: number;
  totalPages: number;
  isLoading: boolean;
  isRefreshing: boolean;
  isChangingPage: boolean;
  isMarkingAll: boolean;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
  onOpen: (notification: NotificationRecord) => void;
  onMarkAllRead: () => void;
};

function pageSlots(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const pages = [
    ...new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages)),
  ].sort((a, b) => a - b);
  const slots: (number | 'gap')[] = [];
  pages.forEach((p, index) => {
    if (index > 0 && p - pages[index - 1] > 1) slots.push('gap');
    slots.push(p);
  });
  return slots;
}

export function NotificationsScreen({
  subtitle,
  notifications,
  unread,
  error,
  page,
  totalPages,
  isLoading,
  isRefreshing,
  isChangingPage,
  isMarkingAll,
  onRefresh,
  onPageChange,
  onOpen,
  onMarkAllRead,
}: Props) {
  const [group, setGroup] = useState<NotificationGroup | 'all'>('all');
  const listRef = useRef<FlatList<NotificationRecord>>(null);

  const changePage = (next: number) => {
    onPageChange(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const tabs = useMemo(() => {
    const counts = new Map<NotificationGroup, number>();
    for (const item of notifications) {
      const key = notificationGroup(item.type);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const items: CardTabItem<NotificationGroup | 'all'>[] = [
      { key: 'all', label: 'Tất cả', count: notifications.length },
      ...[...counts.entries()].map(([key, count]) => ({
        key,
        label: NOTIFICATION_GROUP_LABEL[key],
        count,
      })),
    ];
    return items;
  }, [notifications]);

  const filtered = useMemo(
    () =>
      group === 'all'
        ? notifications
        : notifications.filter((item) => notificationGroup(item.type) === group),
    [notifications, group],
  );

  return (
    <FlowScreen
      headerRight={
        unread > 0 ? (
          <Pressable
            accessibilityRole="button"
            disabled={isMarkingAll}
            hitSlop={10}
            onPress={onMarkAllRead}
          >
            <Text className="font-semibold text-text-link">
              {isMarkingAll ? 'Đang xử lý...' : 'Đọc tất cả'}
            </Text>
          </Pressable>
        ) : null
      }
      muted
      showBack={false}
      title="Thông báo"
    >
      <FlatList
        ref={listRef}
        contentContainerStyle={{
          gap: 10,
          paddingHorizontal: 16,
          paddingBottom: 32,
          paddingTop: 12,
        }}
        data={filtered}
        keyExtractor={(notification) => notification.id}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator className="py-10" color={colors.semantic.actionPrimary} />
          ) : error ? null : notifications.length > 0 ? (
            <View className="items-center gap-2 rounded-2xl bg-bg-card px-5 py-10">
              <Text className="text-lead font-semibold text-text-primary">
                Không có thông báo thuộc nhóm này
              </Text>
              <Text className="text-center text-body text-text-secondary">
                Thử chọn nhóm khác hoặc kéo xuống để tải lại.
              </Text>
            </View>
          ) : (
            <View className="items-center gap-2 rounded-2xl bg-bg-card px-5 py-10">
              <Text className="text-lead font-semibold text-text-primary">Chưa có thông báo</Text>
              <Text className="text-center text-body text-text-secondary">
                Thông báo về hợp đồng, hóa đơn và hoàn tiền sẽ xuất hiện ở đây.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          isChangingPage ? (
            <ActivityIndicator className="py-3" color={colors.semantic.actionPrimary} />
          ) : totalPages > 1 ? (
            <View className="mt-2 flex-row items-center justify-center gap-1.5">
              <Button
                accessibilityLabel="Trang trước"
                disabled={page <= 1}
                fullWidth={false}
                onPress={() => changePage(page - 1)}
                size="sm"
                variant="secondary"
              >
                <CaretLeft color={colors.semantic.textPrimary} size={16} />
              </Button>
              {pageSlots(page, totalPages).map((slot, index) =>
                slot === 'gap' ? (
                  <Text key={`gap-${index}`} className="px-1 text-body text-text-secondary">
                    …
                  </Text>
                ) : (
                  <TabChip
                    key={slot}
                    label={String(slot)}
                    onPress={() => changePage(slot)}
                    selected={slot === page}
                    tone="surface"
                  />
                ),
              )}
              <Button
                accessibilityLabel="Trang sau"
                disabled={page >= totalPages}
                fullWidth={false}
                onPress={() => changePage(page + 1)}
                size="sm"
                variant="secondary"
              >
                <CaretRight color={colors.semantic.textPrimary} size={16} />
              </Button>
            </View>
          ) : null
        }
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <Text className="text-caption text-text-secondary">{subtitle}</Text>

            {error ? (
              <View className="gap-3 rounded-2xl bg-bg-card p-4">
                <InlineMessage message={error} type="error" />
                <Button
                  fullWidth={false}
                  label="Thử lại"
                  onPress={onRefresh}
                  size="sm"
                  variant="secondary"
                />
              </View>
            ) : null}

            {notifications.length > 0 ? (
              <CardTabs
                onChange={(next) => setGroup(next)}
                tabs={tabs}
                testID="notifications-tabs"
                tone="surface"
                value={group}
              />
            ) : null}
          </View>
        }
        refreshControl={
          <RefreshControl
            onRefresh={onRefresh}
            refreshing={isRefreshing}
            tintColor={colors.semantic.actionPrimary}
          />
        }
        renderItem={({ item }) => (
          <NotificationRow notification={item} onPress={() => onOpen(item)} />
        )}
        showsVerticalScrollIndicator={false}
      />
    </FlowScreen>
  );
}
