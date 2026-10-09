import { TicketStatus } from '@storage/types';
import { Button, Card, Chip } from 'heroui-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { formatIsoDateTime } from '../../../lib/format-vi';
import { UploadsApi } from '../../../lib/uploads-api';
import type {
  ServiceTicketRecord,
  TicketAttachment,
  TicketHistoryEntry,
} from '../../types/ticket-api';
import {
  CANCELLABLE_STATUSES,
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_COLOR,
  TICKET_STATUS_LABEL,
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
};

export function TicketDetailScreen({
  ticket,
  isLoading,
  isCancelling,
  error,
  sessionUserId,
  onCancel,
  onRetry,
}: Props) {
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <View className="px-4 pb-4 pt-5">
        <Text className="text-2xl font-bold tracking-tight text-foreground">Chi tiết yêu cầu</Text>
        {ticket ? (
          <Text className="mt-1 font-mono text-sm text-muted">{ticket.ticket_no}</Text>
        ) : null}
      </View>

      <View className="gap-4 px-4">
        {error ? (
          <View className="rounded-xl border border-danger/30 bg-danger/5 p-3">
            <Text className="text-sm text-danger">{error}</Text>
            <Button className="mt-3" size="sm" variant="secondary" onPress={onRetry}>
              <Button.Label>Thử lại</Button.Label>
            </Button>
          </View>
        ) : null}

        {isLoading && !ticket ? <ActivityIndicator /> : null}

        {ticket ? (
          <>
            <Card className="border border-border bg-surface">
              <Card.Body className="gap-3">
                <View className="flex-row items-center gap-2">
                  <Chip color={TICKET_STATUS_COLOR[ticket.status]} size="sm" variant="soft">
                    <Chip.Label>{TICKET_STATUS_LABEL[ticket.status]}</Chip.Label>
                  </Chip>
                  <Chip color="default" size="sm" variant="soft">
                    <Chip.Label>{TICKET_PRIORITY_LABEL[ticket.priority]}</Chip.Label>
                  </Chip>
                  {ticket.type ? (
                    <Chip color="default" size="sm" variant="soft">
                      <Chip.Label>{ticket.type.name}</Chip.Label>
                    </Chip>
                  ) : null}
                </View>

                <Text className="text-lg font-bold text-foreground">{ticket.subject}</Text>
                <Text className="text-sm leading-5 text-foreground">{ticket.description}</Text>

                <View className="h-px bg-separator" />
                <DetailRow label="Cơ sở" value={ticket.facility?.name ?? '—'} />
                <DetailRow
                  label="Kho"
                  value={
                    ticket.storage_unit
                      ? `${ticket.storage_unit.name} (${ticket.storage_unit.code})`
                      : 'Toàn cơ sở'
                  }
                />
                <DetailRow label="Ngày tạo" value={formatIsoDateTime(ticket.created_at)} />
                {ticket.resolution ? <DetailRow label="Kết quả" value={ticket.resolution} /> : null}
              </Card.Body>
            </Card>

            {ticket.attachments.length > 0 ? (
              <Card className="border border-border bg-surface">
                <Card.Body className="gap-3">
                  <Text className="text-sm font-bold text-foreground">Ảnh đính kèm</Text>
                  <View className="flex-row flex-wrap gap-3">
                    {ticket.attachments.map((attachment) => (
                      <AttachmentThumb key={attachment.fileKey} attachment={attachment} />
                    ))}
                  </View>
                </Card.Body>
              </Card>
            ) : null}

            <Card className="border border-border bg-surface">
              <Card.Body className="gap-3">
                <Text className="text-sm font-bold text-foreground">Tiến trình</Text>
                <HistoryTimeline
                  history={ticket.history}
                  createdAt={ticket.created_at}
                  sessionUserId={sessionUserId}
                />
              </Card.Body>
            </Card>

            {CANCELLABLE_STATUSES.includes(ticket.status) ? (
              <Button variant="danger-soft" isDisabled={isCancelling} onPress={onCancel}>
                <Button.Label>{isCancelling ? 'Đang hủy...' : 'Hủy yêu cầu'}</Button.Label>
              </Button>
            ) : null}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="flex-1 text-right text-sm font-semibold text-foreground">{value}</Text>
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
            <Text className="text-sm font-semibold text-foreground">{entry.label}</Text>
            {entry.detail ? (
              <Text className="mt-0.5 text-xs text-muted">{entry.detail}</Text>
            ) : null}
            <Text className="mt-0.5 text-xs text-muted">
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
          <Text className="text-center text-[10px] text-muted" numberOfLines={3}>
            {attachment.name}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
