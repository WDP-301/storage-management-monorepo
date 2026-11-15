import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRef } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { AlertSheet, Button, colors, FlowScreen, InlineMessage } from '../../components/ui';
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
  const cancelRef = useRef<BottomSheetModal>(null);

  return (
    <FlowScreen muted onBack={onBack} title="Chi tiết yêu cầu" titleAlign="left">
      <ScrollView
        className="flex-1 bg-bg-muted"
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
            <InlineMessage message={error} type="error" />
            <Button label="Thử lại" onPress={onRetry} size="sm" variant="secondary" />
          </View>
        ) : null}

        {isLoading && !ticket ? <ActivityIndicator color={colors.semantic.actionPrimary} /> : null}

        {ticket ? (
          <>
            <TicketSummaryCard ticket={ticket} />
            <TicketAttachmentsCard attachments={ticket.attachments} />
            <TicketHistoryCard
              ticket={ticket}
              describeActor={(userId) => (userId === sessionUserId ? 'Bạn' : 'Nhân viên')}
            />

            {CANCELLABLE_STATUSES.includes(ticket.status) ? (
              <Button
                disabled={isCancelling}
                fullWidth
                label={isCancelling ? 'Đang hủy...' : 'Hủy yêu cầu'}
                loading={isCancelling}
                onPress={() => cancelRef.current?.present()}
                variant="destructive"
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <AlertSheet
        ref={cancelRef}
        destructive
        message="Bạn chắc chắn muốn hủy yêu cầu hỗ trợ này?"
        onPrimary={() => {
          cancelRef.current?.dismiss();
          onCancel();
        }}
        onSecondary={() => cancelRef.current?.dismiss()}
        primaryLabel="Hủy yêu cầu"
        secondaryLabel="Không"
        title="Hủy yêu cầu hỗ trợ"
      />
    </FlowScreen>
  );
}
