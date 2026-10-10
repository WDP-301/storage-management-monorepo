import { TicketStatus } from '@storage/types';
import { Button } from 'heroui-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { formatIsoDateTime } from '../../../lib/format-vi';
import { UploadsApi } from '../../../lib/uploads-api';
import { ScreenHeader } from '../../components/ScreenHeader';
import type {
  ServiceTicketRecord,
  TicketAttachment,
  TicketHistoryEntry,
} from '../../types/ticket-api';
import { StatusPill } from './contract-display';
import {
  CANCELLABLE_STATUSES,
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_TONE,
} from './ticket-display';

const HISTORY_ACTION_LABEL: Record<string, string> = {
  ASSIGNED: 'Phân công xử lý',
  STATUS_CHANGED: 'Đổi trạng thái',
  PRIORITY_CHANGED: 'Đổi độ ưu tiên',
};

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
              <View className="gap-2.5 rounded-xl border border-border bg-surface p-3">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="font-numeric text-num-sm text-muted">{ticket.ticket_no}</Text>
                  <StatusPill
                    label={TICKET_STATUS_LABEL[ticket.status]}
                    tone={TICKET_STATUS_TONE[ticket.status]}
                  />
                </View>
                <View className="flex-row flex-wrap items-center gap-2">
                  <StatusPill
                    label={`Ưu tiên: ${TICKET_PRIORITY_LABEL[ticket.priority]}`}
                    tone="neutral"
                  />
                  {ticket.type ? <StatusPill label={ticket.type.name} tone="neutral" /> : null}
                </View>

                <Text className="text-title-sm font-strong text-foreground">{ticket.subject}</Text>
                <Text className="font-body text-body-sm leading-5 text-foreground">
                  {ticket.description}
                </Text>

                <View className="h-px bg-separator" />
                <DetailRow label="Chi nhánh" value={ticket.facility?.name ?? '—'} />
                <DetailRow
                  label="Kho"
                  value={
                    ticket.storage_unit
                      ? `${ticket.storage_unit.name} (${ticket.storage_unit.code})`
                      : 'Toàn chi nhánh'
                  }
                />
                <DetailRow
                  isNumeric
                  label="Ngày tạo"
                  value={formatIsoDateTime(ticket.created_at)}
                />
                {ticket.resolution ? <DetailRow label="Kết quả" value={ticket.resolution} /> : null}
              </View>

              {ticket.attachments.length > 0 ? (
                <View className="gap-2.5 rounded-xl border border-border bg-surface p-3">
                  <Text className="font-strong text-body-lg text-foreground">Ảnh đính kèm</Text>
                  <View className="flex-row flex-wrap gap-3">
                    {ticket.attachments.map((attachment) => (
                      <AttachmentThumb key={attachment.fileKey} attachment={attachment} />
                    ))}
                  </View>
                </View>
              ) : null}

              <View className="gap-2.5 rounded-xl border border-border bg-surface p-3">
                <Text className="font-strong text-body-lg text-foreground">Tiến trình</Text>
                <HistoryTimeline
                  history={ticket.history}
                  createdAt={ticket.created_at}
                  sessionUserId={sessionUserId}
                />
              </View>

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

function DetailRow({
  label,
  value,
  isNumeric = false,
}: {
  label: string;
  value: string;
  isNumeric?: boolean;
}) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="font-body text-body-sm text-muted">{label}</Text>
      <Text
        className={`flex-1 text-right text-foreground ${
          isNumeric ? 'font-numeric text-num-md' : 'font-strong text-body-sm'
        }`}
      >
        {value}
      </Text>
    </View>
  );
}

function HistoryTimeline({
  history,
  createdAt,
  sessionUserId,
}: {
  history: TicketHistoryEntry[];
  createdAt: string;
  sessionUserId: string | undefined;
}) {
  // A fresh OPEN ticket has an empty history — the created_at row keeps the timeline
  // from rendering blank.
  const entries: { label: string; detail: string; at: string; by: string | null }[] = [
    { label: 'Đã tạo yêu cầu', detail: '', at: createdAt, by: sessionUserId ?? null },
    ...history.map((entry) => ({
      label: HISTORY_ACTION_LABEL[entry.action] ?? entry.action,
      detail:
        entry.action === 'STATUS_CHANGED'
          ? `${statusLabel(entry.from)} → ${statusLabel(entry.to)}`
          : entry.from
            ? `${entry.from} → ${entry.to}`
            : entry.to,
      at: entry.at,
      by: entry.by,
    })),
  ];

  return (
    <View className="gap-3">
      {entries.map((entry, index) => (
        <View key={`${entry.at}-${index}`} className="flex-row gap-3">
          <View className="items-center pt-1">
            <View className="size-2 rounded-full bg-accent" />
            {index < entries.length - 1 ? <View className="w-px flex-1 bg-separator" /> : null}
          </View>
          <View className="flex-1 pb-1">
            <Text className="text-body-sm font-strong text-foreground">{entry.label}</Text>
            {entry.detail ? (
              <Text className="font-body mt-0.5 text-caption text-muted">{entry.detail}</Text>
            ) : null}
            <Text className="font-numeric mt-0.5 text-num-sm text-muted">
              {formatIsoDateTime(entry.at)}
              {entry.by ? ` · ${entry.by === sessionUserId ? 'Bạn' : 'Nhân viên'}` : ''}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function statusLabel(status: string | null): string {
  return status ? (TICKET_STATUS_LABEL[status as TicketStatus] ?? status) : '—';
}

/** Presigned download URLs expire — resolve on mount for the thumb, re-resolve on tap. */
function AttachmentThumb({ attachment }: { attachment: TicketAttachment }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = attachment.mimeType.startsWith('image/');

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    UploadsApi.downloadUrl(attachment.fileKey)
      .then((res) => {
        if (!cancelled) setUrl(res.downloadUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [attachment.fileKey, isImage]);

  const open = async () => {
    try {
      const res = await UploadsApi.downloadUrl(attachment.fileKey);
      await Linking.openURL(res.downloadUrl);
    } catch {
      // The row stays put — a transient presign failure is not worth an alert.
    }
  };

  return (
    <Pressable onPress={() => void open()}>
      {isImage && url ? (
        <Image source={{ uri: url }} className="size-20 rounded-lg" resizeMode="cover" />
      ) : (
        <View className="size-20 items-center justify-center rounded-lg border border-border bg-background p-1">
          <Text className="font-body text-center text-caption text-muted" numberOfLines={3}>
            {attachment.name}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
