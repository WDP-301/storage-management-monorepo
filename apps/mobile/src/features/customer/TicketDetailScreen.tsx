import { Button } from 'heroui-native';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { ScreenHeader } from '../../components/ScreenHeader';
import type { ServiceTicketRecord } from '../../types/ticket-api';
import { TicketAttachmentsCard, TicketHistoryCard, TicketSummaryCard } from './ticket-detail-parts';
import { CANCELLABLE_STATUSES } from './ticket-display';

type Props = {
  ticket: ServiceTicketRecord | null;
  isLoading: boolean;
  isCancelling: boolean;
  error: string | null;
  /** Session user id — history entries by them render as "Bạn" instead of a raw UUID. */
  sessionUserId: string | undefined;
  onCancel: () => void;
  onRetry: () => void;
  onBack: () => void;
};

export function TicketDetailScreen({
  ticket,
  isLoading,
  isCancelling,
  error,
  sessionUserId,
  onCancel,
  onRetry,
  onBack,
}: Props) {
  return (
    <View className="flex-1">
      <ScreenHeader
        backLabel="Quay lại danh sách yêu cầu"
        title="Chi tiết yêu cầu"
        onBack={onBack}
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-3 px-4">
          {error ? (
            <View className="rounded-xl border border-danger/30 bg-danger-bg p-3">
              <Text className="font-body text-body-sm text-danger">{error}</Text>
              <Button className="mt-3" size="sm" variant="secondary" onPress={onRetry}>
                <Button.Label className="font-ui">Thử lại</Button.Label>
              </Button>
            </View>
          ) : null}

          {isLoading && !ticket ? <ActivityIndicator /> : null}

          {ticket ? (
            <>
              <TicketSummaryCard ticket={ticket} />
              <TicketAttachmentsCard attachments={ticket.attachments} />
              <TicketHistoryCard
                ticket={ticket}
                describeActor={(userId) => (userId === sessionUserId ? 'Bạn' : 'Nhân viên')}
              />

              {CANCELLABLE_STATUSES.includes(ticket.status) ? (
                <Button variant="danger-soft" isDisabled={isCancelling} onPress={onCancel}>
                  <Button.Label className="font-ui">
                    {isCancelling ? 'Đang hủy...' : 'Hủy yêu cầu'}
                  </Button.Label>
                </Button>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
