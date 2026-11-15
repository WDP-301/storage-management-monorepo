import { TicketStatus } from '@storage/types';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { formatIsoDateTime } from '../../../lib/format-vi';
import {
  Button,
  CardTabs,
  colors,
  FlowScreen,
  InlineMessage,
  TabChip,
  Text,
} from '../../components/ui';
import type { ServiceTicketRecord, TicketFormOptions } from '../../types/ticket-api';
import { StatusPill } from './contract-display';
import { TICKET_STATUS_LABEL, TICKET_STATUS_TONE } from './ticket-display';

type TicketGroup = 'active' | 'done';

const ACTIVE_STATUSES: readonly TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
];

const DONE_STATUSES: readonly TicketStatus[] = [
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
  TicketStatus.CANCELLED,
];

type Props = {
  tickets: ServiceTicketRecord[];
  /** Null while the first load is in flight — CTA visibility waits for it. */
  options: TicketFormOptions | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  statusFilter: TicketStatus | null;
  onFilterStatus: (status: TicketStatus | null) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onOpenTicket: (id: string) => void;
  onCreate: () => void;
  onBack: () => void;
};

export function MyTicketsScreen({
  tickets,
  options,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  statusFilter,
  onFilterStatus,
  onRefresh,
  onLoadMore,
  onOpenTicket,
  onCreate,
  onBack,
}: Props) {
  const canCreate = options !== null && options.facilities.length > 0;
  const [selectedGroup, setSelectedGroup] = useState<TicketGroup | null>(null);

  const activeTickets = tickets.filter((t) => ACTIVE_STATUSES.includes(t.status));
  const doneTickets = tickets.filter((t) => DONE_STATUSES.includes(t.status));

  const group: TicketGroup = statusFilter
    ? DONE_STATUSES.includes(statusFilter)
      ? 'done'
      : 'active'
    : (selectedGroup ?? (activeTickets.length > 0 || doneTickets.length === 0 ? 'active' : 'done'));

  const visibleTickets =
    statusFilter !== null ? tickets : group === 'active' ? activeTickets : doneTickets;

  const subStatuses = group === 'active' ? ACTIVE_STATUSES : DONE_STATUSES;

  const handleGroupChange = (next: TicketGroup) => {
    setSelectedGroup(next);
    if (statusFilter !== null) onFilterStatus(null);
  };

  return (
    <FlowScreen
      muted
      headerRight={
        canCreate ? (
          <Button label="Tạo mới" onPress={onCreate} size="sm" variant="primary" />
        ) : undefined
      }
      onBack={onBack}
      title="Yêu cầu hỗ trợ"
      titleAlign="left"
    >
      <ScrollView
        className="flex-1 bg-bg-muted"
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
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
        <Text className="text-body-sm text-text-secondary">
          Gửi và theo dõi các yêu cầu với chi nhánh.
        </Text>

        <CardTabs
          onChange={handleGroupChange}
          tabs={[
            {
              key: 'active',
              label: 'Đang xử lý',
              count: statusFilter === null ? activeTickets.length : undefined,
            },
            {
              key: 'done',
              label: 'Đã xong',
              count: statusFilter === null ? doneTickets.length : undefined,
            },
          ]}
          tone="surface"
          value={group}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          <TabChip
            label="Tất cả"
            onPress={() => onFilterStatus(null)}
            selected={statusFilter === null}
            tone="primary"
          />
          {subStatuses.map((status) => (
            <TabChip
              key={status}
              label={TICKET_STATUS_LABEL[status]}
              onPress={() => onFilterStatus(statusFilter === status ? null : status)}
              selected={statusFilter === status}
              tone="primary"
            />
          ))}
        </ScrollView>

        {error ? (
          <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
            <InlineMessage message={error} type="error" />
            <Button label="Thử lại" onPress={onRefresh} size="sm" variant="secondary" />
          </View>
        ) : null}

        {options !== null && options.facilities.length === 0 ? (
          <View className="rounded-[20px] border border-border-default bg-bg-card p-4">
            <Text className="text-body-sm leading-5 text-text-secondary">
              Bạn cần đặt cọc hoặc thuê kho để gửi yêu cầu hỗ trợ. Các yêu cầu gắn với chi nhánh
              hoặc kho của bạn.
            </Text>
          </View>
        ) : null}

        {isLoading && tickets.length === 0 ? (
          <ActivityIndicator color={colors.semantic.actionPrimary} />
        ) : null}

        {!isLoading && visibleTickets.length === 0 && !error ? (
          <View className="items-center gap-3 rounded-[20px] border border-dashed border-border-strong bg-bg-card px-5 py-10">
            <Text className="text-body font-semibold text-text-primary">Chưa có yêu cầu nào</Text>
            {canCreate ? (
              <Button label="Tạo yêu cầu" onPress={onCreate} size="sm" variant="secondary" />
            ) : null}
          </View>
        ) : null}

        {visibleTickets.map((ticket) => (
          <Pressable
            key={ticket.id}
            accessibilityRole="button"
            style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
            onPress={() => onOpenTicket(ticket.id)}
          >
            <View className="gap-2 rounded-[20px] border border-border-default bg-bg-card p-4">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-caption text-text-secondary" numberOfLines={1}>
                  {[ticket.type?.name, ticket.facility?.name ?? ticket.facility_id]
                    .filter(Boolean)
                    .join(' · ') || 'Yêu cầu hỗ trợ'}
                </Text>
                <StatusPill
                  label={TICKET_STATUS_LABEL[ticket.status] ?? ticket.status}
                  tone={TICKET_STATUS_TONE[ticket.status] ?? 'neutral'}
                />
              </View>
              <Text className="text-body-lg font-bold text-text-primary" numberOfLines={2}>
                {ticket.subject}
              </Text>
              <Text className="text-caption text-text-secondary tabular-nums">
                {formatIsoDateTime(ticket.created_at)}
              </Text>
            </View>
          </Pressable>
        ))}

        {isLoadingMore ? <ActivityIndicator color={colors.semantic.actionPrimary} /> : null}
        {!isLoading && !hasMore && visibleTickets.length > 0 ? (
          <Text className="pb-2 text-center text-caption text-text-secondary">
            Đã hiển thị hết yêu cầu.
          </Text>
        ) : null}
      </ScrollView>
    </FlowScreen>
  );
}
