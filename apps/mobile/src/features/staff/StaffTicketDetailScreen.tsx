import { ActivityIndicator, ScrollView, View } from 'react-native';
import type { PickedFile } from '../../../lib/uploads-api';
import { Button, colors, FlowScreen, InlineMessage } from '../../components/ui';
import type { ServiceTicketRecord } from '../../types/ticket-api';
import {
  DetailRow,
  TicketAttachmentsCard,
  TicketHistoryCard,
  TicketSummaryCard,
} from '../customer/ticket-detail-parts';
import { type FinishMode, TicketFinishForm } from './TicketFinishForm';
import { TicketReceiptLink } from './TicketReceiptLink';
import type { TicketActionSet } from './ticket-actions';

export type FinishDraft = { mode: FinishMode; note: string; photos: PickedFile[] };

type Props = {
  ticket: ServiceTicketRecord | null;
  actions: TicketActionSet;
  sessionUserId: string | undefined;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  /** Open resolve/close form; null while only the action buttons show. */
  draft: FinishDraft | null;
  onStart: () => void;
  onOpenFinish: (mode: FinishMode) => void;
  onChangeDraft: (patch: Partial<FinishDraft>) => void;
  onAddPhotos: (source: 'camera' | 'library') => void;
  onSubmitFinish: () => void;
  onCancelFinish: () => void;
  onRetry: () => void;
  onBack: () => void;
};

export function StaffTicketDetailScreen({
  ticket,
  actions,
  sessionUserId,
  isLoading,
  isSaving,
  error,
  draft,
  onStart,
  onOpenFinish,
  onChangeDraft,
  onAddPhotos,
  onSubmitFinish,
  onCancelFinish,
  onRetry,
  onBack,
}: Props) {
  const describeActor = (userId: string) => {
    if (userId === sessionUserId) return 'Bạn';
    if (userId === ticket?.customer_id) return 'Khách hàng';
    if (userId === ticket?.assigned_to) return 'Nhân viên phụ trách';
    return 'Quản lý';
  };

  return (
    <FlowScreen
      backLabel="Quay lại danh sách yêu cầu"
      muted
      onBack={onBack}
      title="Chi tiết yêu cầu"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: draft ? 240 : 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-3 px-4 pt-4">
          {error ? (
            <View className="gap-3 rounded-[20px] border border-border-error/30 bg-danger-0 p-4">
              <InlineMessage message={error} type="error" />
              <Button label="Tải lại" onPress={onRetry} size="sm" variant="secondary" />
            </View>
          ) : null}

          {isLoading && !ticket ? (
            <ActivityIndicator className="py-6" color={colors.semantic.actionPrimary} />
          ) : null}

          {ticket ? (
            <>
              <TicketSummaryCard ticket={ticket}>
                <DetailRow label="Khách hàng" value={ticket.customer?.full_name ?? '—'} />
                <DetailRow
                  label="Phụ trách"
                  value={ticket.assignee?.full_name ?? 'Chưa phân công'}
                />
              </TicketSummaryCard>

              <TicketReceiptLink receipt={ticket.shelf_receipt} ticketId={ticket.id} />

              {actions.hint ? (
                <View className="rounded-[20px] border border-border-default bg-bg-card p-4">
                  <InlineMessage message={actions.hint} type="info" />
                </View>
              ) : null}

              {draft ? (
                <TicketFinishForm
                  isSaving={isSaving}
                  mode={draft.mode}
                  note={draft.note}
                  onAddPhotos={onAddPhotos}
                  onCancel={onCancelFinish}
                  onChangeNote={(note) => onChangeDraft({ note })}
                  onRemovePhoto={(uri) =>
                    onChangeDraft({ photos: draft.photos.filter((photo) => photo.uri !== uri) })
                  }
                  onSubmit={onSubmitFinish}
                  photos={draft.photos}
                />
              ) : (
                <ActionButtons
                  actions={actions}
                  isSaving={isSaving}
                  onOpenFinish={onOpenFinish}
                  onStart={onStart}
                />
              )}

              <TicketAttachmentsCard attachments={ticket.attachments} />
              <TicketHistoryCard describeActor={describeActor} ticket={ticket} />
            </>
          ) : null}
        </View>
      </ScrollView>
    </FlowScreen>
  );
}

function ActionButtons({
  actions,
  isSaving,
  onStart,
  onOpenFinish,
}: {
  actions: TicketActionSet;
  isSaving: boolean;
  onStart: () => void;
  onOpenFinish: (mode: FinishMode) => void;
}) {
  if (!actions.canStart && !actions.canResolve && !actions.canClose) return null;
  return (
    <View className="gap-2.5">
      {actions.canStart ? (
        <Button
          disabled={isSaving}
          fullWidth
          label={isSaving ? 'Đang cập nhật...' : 'Bắt đầu xử lý'}
          loading={isSaving}
          onPress={onStart}
        />
      ) : null}
      {actions.canResolve ? (
        <Button
          disabled={isSaving}
          fullWidth
          label="Hoàn tất xử lý"
          onPress={() => onOpenFinish('resolve')}
        />
      ) : null}
      {actions.canClose ? (
        <Button
          disabled={isSaving}
          fullWidth
          label="Đóng yêu cầu"
          onPress={() => onOpenFinish('close')}
          variant="destructive"
        />
      ) : null}
    </View>
  );
}
