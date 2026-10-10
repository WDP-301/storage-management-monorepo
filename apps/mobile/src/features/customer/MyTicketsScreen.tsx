import { TicketStatus } from '@storage/types';
import { Button } from 'heroui-native';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { formatIsoDateTime } from '../../../lib/format-vi';
import { FilterPill } from '../../components/FilterPill';
import { ScreenHeader } from '../../components/ScreenHeader';
import type { ServiceTicketRecord, TicketFormOptions } from '../../types/ticket-api';
import { StatusPill } from './contract-display';
import { TICKET_STATUS_LABEL, TICKET_STATUS_TONE } from './ticket-display';

const STATUS_FILTERS: (TicketStatus | null)[] = [
  null,
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.RESOLVED,
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
      <ScreenHeader
        backLabel="Quay lại Tài khoản"
        title="Yêu cầu hỗ trợ"
        onBack={onBack}
        right={
          canCreate ? (
            <Button size="sm" onPress={onCreate}>
              <Button.Label className="font-ui">Tạo yêu cầu</Button.Label>
            </Button>
          ) : null
        }
      />
      <Text className="font-body px-4 pb-3 text-body-sm text-muted">
        Gửi và theo dõi các yêu cầu với chi nhánh.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}
      >
        {STATUS_FILTERS.map((status) => (
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

        {options !== null && options.facilities.length === 0 ? (
          <View className="rounded-xl border border-border bg-surface p-3">
            <Text className="font-body text-body-sm leading-5 text-muted">
              Bạn cần đặt cọc hoặc thuê kho để gửi yêu cầu hỗ trợ. Các yêu cầu gắn với chi nhánh
              hoặc kho của bạn.
            </Text>
          </View>
        ) : null}

        {isLoading && tickets.length === 0 ? <ActivityIndicator /> : null}

        {!isLoading && tickets.length === 0 && !error ? (
          <View className="items-center gap-3 rounded-2xl border border-border border-dashed px-5 py-10">
            <Text className="font-strong text-body-md text-foreground">Chưa có yêu cầu nào</Text>
            {canCreate ? (
              <Button size="sm" variant="secondary" onPress={onCreate}>
                <Button.Label className="font-ui">Tạo yêu cầu</Button.Label>
              </Button>
            ) : null}
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
                <StatusPill
                  label={TICKET_STATUS_LABEL[ticket.status]}
                  tone={TICKET_STATUS_TONE[ticket.status]}
                />
              </View>
              <Text className="font-strong text-body-lg text-foreground" numberOfLines={2}>
                {ticket.subject}
              </Text>
              <Text className="font-body text-caption text-muted" numberOfLines={1}>
                {[ticket.type?.name, ticket.facility?.name ?? ticket.facility_id]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <Text className="font-numeric text-num-sm text-muted">
                {formatIsoDateTime(ticket.created_at)}
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
