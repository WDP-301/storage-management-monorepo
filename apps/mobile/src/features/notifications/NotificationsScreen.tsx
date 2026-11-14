import { Button } from 'heroui-native';
import { CaretLeft, CaretRight } from 'phosphor-react-native';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, Text, View } from 'react-native';
import type { NotificationRecord } from '../../types/notification-api';
import { ChipButton } from '../customer/FilterChips';
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

/**
 * Pager slots: every page number when they fit, otherwise first/last page plus the current page's
 * neighbours with `…` filling the gaps.
 */
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

  // Chips only cover the page currently loaded; other pages can hold different groups.
  const groups = useMemo(() => {
    const counts = new Map<NotificationGroup, number>();
    for (const item of notifications) {
      const key = notificationGroup(item.type);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [notifications]);

  const filtered = useMemo(
    () =>
      group === 'all'
        ? notifications
        : notifications.filter((item) => notificationGroup(item.type) === group),
    [notifications, group],
  );

  return (
    <FlatList
      ref={listRef}
      data={filtered}
      keyExtractor={(notification) => notification.id}
      renderItem={({ item }) => (
        <NotificationRow notification={item} onPress={() => onOpen(item)} />
      )}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View className="gap-3 pb-1 pt-5">
          <View>
            <Text className="font-strong text-foreground text-title-md">Thông báo</Text>
            <Text className="font-body mt-1 text-body-sm text-muted">{subtitle}</Text>
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

          {notifications.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="-mx-4"
              contentContainerClassName="gap-2 px-4"
            >
              <ChipButton
                label={`Tất cả (${notifications.length})`}
                isSelected={group === 'all'}
                onPress={() => setGroup('all')}
              />
              {groups.map(([key, count]) => (
                <ChipButton
                  key={key}
                  label={`${NOTIFICATION_GROUP_LABEL[key]} (${count})`}
                  isSelected={group === key}
                  onPress={() => setGroup(group === key ? 'all' : key)}
                />
              ))}
            </ScrollView>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator className="py-10" />
        ) : error ? null : notifications.length > 0 ? (
          <View className="items-center gap-2 rounded-2xl border border-border border-dashed px-5 py-10">
            <Text className="font-strong text-body-md text-foreground">
              Không có thông báo thuộc nhóm này
            </Text>
            <Text className="font-body text-center text-body-sm text-muted">
              Thử nhóm khác hoặc kéo xuống để tải thêm thông báo.
            </Text>
          </View>
        ) : (
          <View className="items-center gap-2 rounded-2xl border border-border border-dashed px-5 py-10">
            <Text className="font-strong text-body-md text-foreground">Chưa có thông báo</Text>
            <Text className="font-body text-center text-body-sm text-muted">
              Thông báo về hợp đồng, hóa đơn và hoàn tiền sẽ xuất hiện ở đây.
            </Text>
          </View>
        )
      }
      ListFooterComponent={
        isChangingPage ? (
          <ActivityIndicator className="py-3" />
        ) : totalPages > 1 ? (
          <View className="mt-2 flex-row items-center justify-center gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              isDisabled={page <= 1}
              accessibilityLabel="Trang trước"
              onPress={() => changePage(page - 1)}
            >
              <CaretLeft size={16} />
            </Button>
            {pageSlots(page, totalPages).map((slot, index) =>
              slot === 'gap' ? (
                <Text key={`gap-${index}`} className="px-1 font-numeric text-body-sm text-muted">
                  …
                </Text>
              ) : (
                <ChipButton
                  key={slot}
                  label={String(slot)}
                  isSelected={slot === page}
                  onPress={() => changePage(slot)}
                />
              ),
            )}
            <Button
              size="sm"
              variant="secondary"
              isDisabled={page >= totalPages}
              accessibilityLabel="Trang sau"
              onPress={() => changePage(page + 1)}
            >
              <CaretRight size={16} />
            </Button>
          </View>
        ) : null
      }
    />
  );
}
