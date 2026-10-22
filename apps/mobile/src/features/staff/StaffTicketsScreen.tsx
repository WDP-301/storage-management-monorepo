import { TicketPriority, TicketStatus } from '@storage/types';
import { Button } from 'heroui-native';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { formatIsoDateTime } from '../../../lib/format-vi';
import { FilterPill } from '../../components/FilterPill';
import type { ServiceTicketRecord } from '../../types/ticket-api';
import { StatusPill } from '../customer/contract-display';
import {
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_TONE,
} from '../customer/ticket-display';

const STAFF_FILTERS: (TicketStatus | null)[] = [
  null,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
];
// Managers also see tickets nobody has been assigned to yet.
const MANAGER_FILTERS: (TicketStatus | null)[] = [
  null,
  TicketStatus.OPEN,
  ...STAFF_FILTERS.slice(1),
];

const RAISED_PRIORITIES: readonly TicketPriority[] = [TicketPriority.HIGH, TicketPriority.URGENT];

type Props = {
  tickets: ServiceTicketRecord[];
  isManager: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  statusFilter: TicketStatus | null;
  onFilterStatus: (status: TicketStatus | null) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onOpenTicket: (id: string) => void;
};

export function StaffTicketsScreen({
  tickets,
  isManager,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  statusFilter,
  onFilterStatus,
  onRefresh,
  onLoadMore,
  onOpenTicket,
}: Props) {
  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={isLoading && tickets.length > 0} onRefresh={onRefresh} />
      }
      onScroll={({ nativeEvent }) => {
        const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
        if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 200) {
          onLoadMore();
        }
      }}
      scrollEventThrottle={200}
      showsVerticalScrollIndicator={false}
    >
      <View className="px-4 pb-3 pt-5">
        <Text className="font-strong text-foreground text-title-md">Yêu cầu</Text>
        <Text className="font-body mt-1 text-body-sm text-muted">
          {isManager
            ? 'Yêu cầu hỗ trợ và bảo trì tại chi nhánh. Phân công nhân viên trên trang quản lý web.'
            : 'Yêu cầu hỗ trợ và bảo trì được phân công cho bạn.'}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}
      >
        {(isManager ? MANAGER_FILTERS : STAFF_FILTERS).map((status) => (
          <FilterPill
            key={status ?? 'all'}
            isSelected={statusFilter === status}
            label={status ? TICKET_STATUS_LABEL[status] : 'Tất cả'}
            onPress={() => onFilterStatus(status)}
          />
        ))}
      </ScrollView>

      <View className="gap-3 px-4">
        {error ? (
          <View className="rounded-xl border border-danger/30 bg-danger-bg p-3">
            <Text className="font-body text-body-sm text-danger">{error}</Text>
            <Button className="mt-3" size="sm" variant="secondary" onPress={onRefresh}>
              <Button.Label className="font-ui">Thử lại</Button.Label>
            </Button>
          </View>
        ) : null}

        {isLoading && tickets.length === 0 ? <ActivityIndicator /> : null}

        {!isLoading && tickets.length === 0 && !error ? (
          <View className="items-center gap-1 rounded-2xl border border-border border-dashed px-5 py-10">
            <Text className="font-strong text-body-md text-foreground">Chưa có yêu cầu nào</Text>
            <Text className="font-body text-center text-body-sm text-muted">
              {isManager
                ? 'Yêu cầu khách gửi tới chi nhánh sẽ hiện ở đây.'
                : 'Yêu cầu được quản lý phân công cho bạn sẽ hiện ở đây.'}
            </Text>
          </View>
        ) : null}

        {tickets.map((ticket) => (
          <Pressable
            key={ticket.id}
            accessibilityRole="button"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            onPress={() => onOpenTicket(ticket.id)}
          >
            <View className="gap-2 rounded-xl border border-border bg-surface p-3">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="font-numeric text-num-sm text-muted">{ticket.ticket_no}</Text>
                <View className="flex-row gap-1.5">
                  {RAISED_PRIORITIES.includes(ticket.priority) ? (
                    <StatusPill label={TICKET_PRIORITY_LABEL[ticket.priority]} tone="warning" />
                  ) : null}
                  <StatusPill
                    label={TICKET_STATUS_LABEL[ticket.status]}
                    tone={TICKET_STATUS_TONE[ticket.status]}
                  />
                </View>
              </View>
              <Text className="font-strong text-body-lg text-foreground" numberOfLines={2}>
                {ticket.subject}
              </Text>
              <Text className="font-body text-caption text-muted" numberOfLines={1}>
                {[
                  ticket.type?.name,
                  ticket.storage_unit
                    ? `${ticket.storage_unit.name} (${ticket.storage_unit.code})`
                    : ticket.facility?.name,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <Text className="font-numeric text-num-sm text-muted">
                {formatIsoDateTime(ticket.created_at)}
                {isManager ? ` · ${ticket.assignee?.full_name ?? 'Chưa phân công'}` : ''}
              </Text>
            </View>
          </Pressable>
        ))}

        {isLoadingMore ? <ActivityIndicator /> : null}
        {!isLoading && !hasMore && tickets.length > 0 ? (
          <Text className="font-body pb-2 text-center text-caption text-muted">
            Đã hiển thị hết yêu cầu.
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
