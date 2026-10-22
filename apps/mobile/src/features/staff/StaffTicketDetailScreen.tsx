import { Button } from 'heroui-native';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import type { PickedFile } from '../../../lib/uploads-api';
import { ScreenHeader } from '../../components/ScreenHeader';
import type { ServiceTicketRecord } from '../../types/ticket-api';
import {
  DetailRow,
  TicketAttachmentsCard,
  TicketHistoryCard,
  TicketSummaryCard,
} from '../customer/ticket-detail-parts';
import { type FinishMode, TicketFinishForm } from './TicketFinishForm';
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
    <View className="flex-1">
      <ScreenHeader
        backLabel="Quay lại danh sách yêu cầu"
        title="Chi tiết yêu cầu"
        onBack={onBack}
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: draft ? 240 : 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-3 px-4">
          {error ? (
            <View className="rounded-xl border border-danger/30 bg-danger-bg p-3">
              <Text className="font-body text-body-sm text-danger">{error}</Text>
              <Button className="mt-3" size="sm" variant="secondary" onPress={onRetry}>
                <Button.Label className="font-ui">Tải lại</Button.Label>
              </Button>
            </View>
          ) : null}

          {isLoading && !ticket ? <ActivityIndicator /> : null}

          {ticket ? (
            <>
              <TicketSummaryCard ticket={ticket}>
                <DetailRow label="Khách hàng" value={ticket.customer?.full_name ?? '—'} />
                <DetailRow
                  label="Phụ trách"
                  value={ticket.assignee?.full_name ?? 'Chưa phân công'}
                />
              </TicketSummaryCard>

              {actions.hint ? (
                <View className="rounded-xl border border-border bg-surface p-3">
                  <Text className="font-body text-body-sm text-muted">{actions.hint}</Text>
                </View>
              ) : null}

              {draft ? (
                <TicketFinishForm
                  mode={draft.mode}
                  note={draft.note}
                  photos={draft.photos}
                  isSaving={isSaving}
                  onChangeNote={(note) => onChangeDraft({ note })}
                  onAddPhotos={onAddPhotos}
                  onRemovePhoto={(uri) =>
                    onChangeDraft({ photos: draft.photos.filter((photo) => photo.uri !== uri) })
                  }
                  onSubmit={onSubmitFinish}
                  onCancel={onCancelFinish}
                />
              ) : (
                <ActionButtons
                  actions={actions}
                  isSaving={isSaving}
                  onStart={onStart}
                  onOpenFinish={onOpenFinish}
                />
              )}

              <TicketAttachmentsCard attachments={ticket.attachments} />
              <TicketHistoryCard ticket={ticket} describeActor={describeActor} />
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
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
    <View className="gap-2">
      {actions.canStart ? (
        <Button isDisabled={isSaving} onPress={onStart}>
          <Button.Label className="font-ui">
            {isSaving ? 'Đang cập nhật...' : 'Bắt đầu xử lý'}
          </Button.Label>
        </Button>
      ) : null}
      {actions.canResolve ? (
        <Button isDisabled={isSaving} onPress={() => onOpenFinish('resolve')}>
          <Button.Label className="font-ui">Hoàn tất xử lý</Button.Label>
        </Button>
      ) : null}
      {actions.canClose ? (
        <Button variant="danger-soft" isDisabled={isSaving} onPress={() => onOpenFinish('close')}>
          <Button.Label className="font-ui">Đóng yêu cầu</Button.Label>
        </Button>
      ) : null}
    </View>
  );
}
