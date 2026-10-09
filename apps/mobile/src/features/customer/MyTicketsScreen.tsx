import { TicketStatus } from '@storage/types';
import { Button, Card, Chip } from 'heroui-native';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { formatIsoDateTime } from '../../../lib/format-vi';
import type { ServiceTicketRecord, TicketFormOptions } from '../../types/ticket-api';
import { TICKET_STATUS_COLOR, TICKET_STATUS_LABEL } from './ticket-display';

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
      <View className="flex-row items-center justify-between px-4 pb-4 pt-5">
        <View className="flex-1 pr-3">
          <Text className="text-2xl font-bold tracking-tight text-foreground">Yêu cầu hỗ trợ</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">
            Gửi và theo dõi các yêu cầu với cơ sở kho.
          </Text>
        </View>
        {canCreate ? (
          <Button size="sm" onPress={onCreate}>
            <Button.Label>Tạo yêu cầu</Button.Label>
          </Button>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}
      >
        {STATUS_FILTERS.map((status) => (
          <Chip
            key={status ?? 'all'}
            color={statusFilter === status ? 'accent' : 'default'}
            size="md"
            variant={statusFilter === status ? 'primary' : 'soft'}
            onPress={() => onFilterStatus(status)}
          >
            <Chip.Label>{status ? TICKET_STATUS_LABEL[status] : 'Tất cả'}</Chip.Label>
          </Chip>
        ))}
      </ScrollView>

      <View className="gap-3 px-4">
        {error ? (
          <View className="rounded-xl border border-danger/30 bg-danger/5 p-3">
            <Text className="text-sm text-danger">{error}</Text>
            <Button className="mt-3" size="sm" variant="secondary" onPress={onRefresh}>
              <Button.Label>Thử lại</Button.Label>
            </Button>
          </View>
        ) : null}

        {options !== null && options.facilities.length === 0 ? (
          <Card className="border border-border bg-surface">
            <Card.Body>
              <Text className="text-sm leading-5 text-muted">
                Bạn cần thuê kho để gửi yêu cầu hỗ trợ. Các yêu cầu gắn với cơ sở hoặc kho bạn đang
                thuê.
              </Text>
            </Card.Body>
          </Card>
        ) : null}

        {isLoading && tickets.length === 0 ? <ActivityIndicator /> : null}

        {!isLoading && tickets.length === 0 && !error ? (
          <Card className="border border-border bg-surface">
            <Card.Body className="items-center gap-3 py-8">
              <Text className="text-sm text-muted">Chưa có yêu cầu nào.</Text>
              {canCreate ? (
                <Button size="sm" variant="secondary" onPress={onCreate}>
                  <Button.Label>Tạo yêu cầu</Button.Label>
                </Button>
              ) : null}
            </Card.Body>
          </Card>
        ) : null}

        {tickets.map((ticket) => (
          <Pressable key={ticket.id} onPress={() => onOpenTicket(ticket.id)}>
            <Card className="border border-border bg-surface">
              <Card.Body className="gap-2">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="font-mono text-xs text-muted">{ticket.ticket_no}</Text>
                  <Chip color={TICKET_STATUS_COLOR[ticket.status]} size="sm" variant="soft">
                    <Chip.Label>{TICKET_STATUS_LABEL[ticket.status]}</Chip.Label>
                  </Chip>
                </View>
                <Text className="font-semibold text-foreground" numberOfLines={2}>
                  {ticket.subject}
                </Text>
                <Text className="text-xs text-muted" numberOfLines={1}>
                  {[ticket.type?.name, ticket.facility?.name ?? ticket.facility_id]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                <Text className="text-xs text-muted">{formatIsoDateTime(ticket.created_at)}</Text>
              </Card.Body>
            </Card>
          </Pressable>
        ))}

        {isLoadingMore ? <ActivityIndicator /> : null}
        {!isLoading && !hasMore && tickets.length > 0 ? (
          <Text className="pb-2 text-center text-xs text-muted">Đã hiển thị hết yêu cầu.</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
