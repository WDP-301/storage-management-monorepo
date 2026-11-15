import { TicketPriority, TicketStatus } from '@storage/types';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { formatIsoDateTime } from '../../../lib/format-vi';
import {
  Button,
  CardTabs,
  colors,
  FlowScreen,
  Icon,
  InlineMessage,
  TabChip,
  Text,
} from '../../components/ui';
import type { ServiceTicketRecord } from '../../types/ticket-api';
import { StatusPill } from '../customer/contract-display';
import {
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_TONE,
} from '../customer/ticket-display';

type TabGroup = 'active' | 'done';

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

const STAFF_ACTIVE_FILTERS: (TicketStatus | null)[] = [
  null,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
];
// Managers also see tickets nobody has been assigned to yet.
const MANAGER_ACTIVE_FILTERS: (TicketStatus | null)[] = [
  null,
  TicketStatus.OPEN,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
];
const DONE_FILTERS: (TicketStatus | null)[] = [null, TicketStatus.RESOLVED, TicketStatus.CLOSED];

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
  const [group, setGroup] = useState<TabGroup>(() =>
    statusFilter && DONE_STATUSES.includes(statusFilter) ? 'done' : 'active',
  );

  const subFilters =
    group === 'active' ? (isManager ? MANAGER_ACTIVE_FILTERS : STAFF_ACTIVE_FILTERS) : DONE_FILTERS;

  const allowedStatuses = group === 'active' ? ACTIVE_STATUSES : DONE_STATUSES;
  const visibleTickets = tickets.filter((t) => allowedStatuses.includes(t.status));

  const switchGroup = (next: string) => {
    const nextGroup: TabGroup = next === 'done' ? 'done' : 'active';
    setGroup(nextGroup);
    if (statusFilter !== null) {
      const targetList = nextGroup === 'active' ? ACTIVE_STATUSES : DONE_STATUSES;
      if (!targetList.includes(statusFilter)) onFilterStatus(null);
    }
  };

  return (
    <FlowScreen muted showBack={false} title="Yêu cầu khách" titleAlign="left">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-4 py-4 pb-10"
        onScroll={({ nativeEvent }) => {
          const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
          if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 200) {
            onLoadMore();
          }
        }}
        refreshControl={
          <RefreshControl
            colors={[colors.semantic.actionPrimary]}
            onRefresh={onRefresh}
            refreshing={isLoading && tickets.length > 0}
            tintColor={colors.semantic.actionPrimary}
          />
        }
        scrollEventThrottle={200}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-body text-text-secondary">
          {isManager
            ? 'Yêu cầu hỗ trợ và bảo trì tại chi nhánh. Phân công nhân viên trên trang quản lý web.'
            : 'Yêu cầu hỗ trợ và bảo trì được phân công cho bạn.'}
        </Text>

        <CardTabs
          onChange={switchGroup}
          tabs={[
            { key: 'active', label: 'Cần xử lý' },
            { key: 'done', label: 'Đã xong' },
          ]}
          value={group}
        />

        <ScrollView
          className="-mx-4"
          contentContainerClassName="gap-2 px-4"
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {subFilters.map((status) => (
            <TabChip
              key={status ?? 'all'}
              label={status ? (TICKET_STATUS_LABEL[status] ?? status) : 'Tất cả'}
              onPress={() => onFilterStatus(status)}
              selected={statusFilter === status}
              tone="primary"
            />
          ))}
        </ScrollView>

        {error ? (
          <View className="gap-3 rounded-[20px] border border-border-error/30 bg-danger-0 p-4">
            <InlineMessage message={error} type="error" />
            <Button label="Thử lại" onPress={onRefresh} size="sm" variant="secondary" />
          </View>
        ) : null}

        {isLoading && tickets.length === 0 ? (
          <ActivityIndicator className="py-6" color={colors.semantic.actionPrimary} />
        ) : null}

        {!isLoading && visibleTickets.length === 0 && !error ? (
          <View className="items-center gap-1.5 rounded-[20px] border border-border-default bg-bg-card px-5 py-10">
            <Icon color={colors.semantic.textPlaceholder} name="assignment" size={32} />
            <Text className="text-body-lg font-semibold text-text-primary">
              Chưa có yêu cầu nào
            </Text>
            <Text className="text-center text-body text-text-secondary">
              {isManager
                ? 'Yêu cầu khách gửi tới chi nhánh sẽ hiện ở đây.'
                : 'Yêu cầu được quản lý phân công cho bạn sẽ hiện ở đây.'}
            </Text>
          </View>
        ) : null}

        {visibleTickets.map((ticket) => (
          <Pressable
            key={ticket.id}
            accessibilityRole="button"
            className="gap-2 rounded-[20px] border border-border-default bg-bg-card p-4"
            onPress={() => onOpenTicket(ticket.id)}
            style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
          >
            <View className="flex-row items-center justify-between gap-2">
              <Text className="text-caption font-semibold text-text-secondary tabular-nums">
                {ticket.ticket_no}
              </Text>
              <View className="flex-row items-center gap-1.5">
                {RAISED_PRIORITIES.includes(ticket.priority) ? (
                  <StatusPill
                    label={TICKET_PRIORITY_LABEL[ticket.priority] ?? ticket.priority}
                    tone="warning"
                  />
                ) : null}
                <StatusPill
                  label={TICKET_STATUS_LABEL[ticket.status] ?? ticket.status}
                  tone={TICKET_STATUS_TONE[ticket.status] ?? 'neutral'}
                />
              </View>
            </View>
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-1 gap-1">
                <Text className="text-body-lg font-semibold text-text-primary" numberOfLines={2}>
                  {ticket.subject}
                </Text>
                <Text className="text-caption text-text-secondary" numberOfLines={1}>
                  {[
                    ticket.type?.name,
                    ticket.storage_unit
                      ? `${ticket.storage_unit.name} (${ticket.storage_unit.code})`
                      : ticket.facility?.name,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                <Text className="text-caption text-text-secondary tabular-nums">
                  {formatIsoDateTime(ticket.created_at)}
                  {isManager ? ` · ${ticket.assignee?.full_name ?? 'Chưa phân công'}` : ''}
                </Text>
              </View>
              <Icon color={colors.semantic.textSecondary} name="chevron-right" size={18} />
            </View>
          </Pressable>
        ))}

        {isLoadingMore ? (
          <ActivityIndicator className="py-2" color={colors.semantic.actionPrimary} />
        ) : null}
        {!isLoading && !hasMore && visibleTickets.length > 0 ? (
          <Text className="pb-2 text-center text-caption text-text-secondary">
            Đã hiển thị hết yêu cầu.
          </Text>
        ) : null}
      </ScrollView>
    </FlowScreen>
  );
}
