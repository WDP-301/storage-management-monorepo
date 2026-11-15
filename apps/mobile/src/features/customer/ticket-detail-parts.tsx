import { type TicketPriority, TicketStatus } from '@storage/types';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';
import { formatIsoDateTime } from '../../../lib/format-vi';
import { UploadsApi } from '../../../lib/uploads-api';
import { Dashed, Text } from '../../components/ui';
import type {
  ServiceTicketRecord,
  TicketAttachment,
  TicketHistoryEntry,
} from '../../types/ticket-api';
import { StatusPill } from './contract-display';
import { TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL, TICKET_STATUS_TONE } from './ticket-display';

/** Ticket detail building blocks shared by the customer and staff ticket screens. */

const HISTORY_ACTION_LABEL: Record<string, string> = {
  ASSIGNED: 'Phân công xử lý',
  STATUS_CHANGED: 'Đổi trạng thái',
  PRIORITY_CHANGED: 'Đổi độ ưu tiên',
};

function priorityLabel(priority: string | null): string {
  if (!priority) return '—';
  return TICKET_PRIORITY_LABEL[priority as TicketPriority] ?? priority;
}

/** Header card: status, priority, subject, description and where the ticket is filed. */
export function TicketSummaryCard({
  ticket,
  children,
}: {
  ticket: ServiceTicketRecord;
  /** Extra rows shown after the creation date, e.g. customer and assignee for staff. */
  children?: ReactNode;
}) {
  return (
    <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-row flex-wrap items-center gap-2">
          <StatusPill label={`Ưu tiên: ${priorityLabel(ticket.priority)}`} tone="neutral" />
          {ticket.type ? <StatusPill label={ticket.type.name} tone="neutral" /> : null}
        </View>
        <StatusPill
          label={TICKET_STATUS_LABEL[ticket.status] ?? ticket.status}
          tone={TICKET_STATUS_TONE[ticket.status] ?? 'neutral'}
        />
      </View>

      <Text className="text-subtitle font-bold text-text-primary">{ticket.subject}</Text>
      <Text className="text-body-sm leading-5 text-text-primary">{ticket.description}</Text>

      <Dashed />
      <View className="gap-2">
        <DetailRow label="Chi nhánh" value={ticket.facility?.name ?? '—'} />
        <DetailRow
          label="Kho"
          value={ticket.storage_unit ? ticket.storage_unit.name : 'Toàn chi nhánh'}
        />
        <DetailRow isNumeric label="Ngày tạo" value={formatIsoDateTime(ticket.created_at)} />
        {children}
        {ticket.resolution ? <DetailRow label="Kết quả" value={ticket.resolution} /> : null}
      </View>
    </View>
  );
}

export function TicketAttachmentsCard({ attachments }: { attachments: TicketAttachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
      <Text className="text-lead font-bold text-text-primary">Ảnh đính kèm</Text>
      <View className="flex-row flex-wrap gap-3">
        {attachments.map((attachment) => (
          <AttachmentThumb key={attachment.fileKey} attachment={attachment} />
        ))}
      </View>
    </View>
  );
}

export function TicketHistoryCard({
  ticket,
  describeActor,
}: {
  ticket: ServiceTicketRecord;
  /** Who a user id is from the viewer's point of view ("Bạn", "Khách hàng", …) — never the raw id. */
  describeActor: (userId: string) => string;
}) {
  // A fresh OPEN ticket has an empty history — the created_at row keeps the timeline
  // from rendering blank.
  const entries = [
    { label: 'Đã tạo yêu cầu', detail: '', at: ticket.created_at, by: ticket.customer_id },
    ...ticket.history.map((entry) => ({
      label: HISTORY_ACTION_LABEL[entry.action] ?? entry.action,
      detail: historyDetail(entry),
      at: entry.at,
      by: entry.by as string | null,
    })),
  ];

  return (
    <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
      <Text className="text-lead font-bold text-text-primary">Tiến trình</Text>
      <Dashed />
      <View className="gap-3">
        {entries.map((entry, index) => (
          <View key={`${entry.at}-${index}`} className="flex-row gap-3">
            <View className="items-center pt-1.5">
              <View className="size-2 rounded-full bg-action-primary" />
              {index < entries.length - 1 ? (
                <View className="w-px flex-1 bg-border-divider" />
              ) : null}
            </View>
            <View className="flex-1 pb-1">
              <Text className="text-body-sm font-semibold text-text-primary">{entry.label}</Text>
              {entry.detail ? (
                <Text className="mt-0.5 text-caption text-text-secondary">{entry.detail}</Text>
              ) : null}
              <Text className="mt-0.5 text-caption text-text-secondary tabular-nums">
                {formatIsoDateTime(entry.at)}
                {entry.by ? ` · ${describeActor(entry.by)}` : ''}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function DetailRow({
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
      <Text className="text-body-sm text-text-secondary">{label}</Text>
      <Text
        className={`flex-1 text-right text-body-sm font-semibold text-text-primary ${
          isNumeric ? 'tabular-nums' : ''
        }`}
      >
        {value}
      </Text>
    </View>
  );
}

function historyDetail(entry: TicketHistoryEntry): string {
  if (entry.action === 'STATUS_CHANGED') {
    return `${statusLabel(entry.from)} → ${statusLabel(entry.to)}`;
  }
  if (entry.action === 'PRIORITY_CHANGED') {
    return entry.from
      ? `${priorityLabel(entry.from)} → ${priorityLabel(entry.to)}`
      : priorityLabel(entry.to);
  }
  // ASSIGNED stores the previous assignee as a user id but the new one as a name — show the name.
  if (entry.action === 'ASSIGNED') return entry.to;
  return entry.from ? `${entry.from} → ${entry.to}` : entry.to;
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
        <Image source={{ uri: url }} className="size-20 rounded-xl" resizeMode="cover" />
      ) : (
        <View className="size-20 items-center justify-center rounded-xl border border-border-default bg-bg-subtle p-1.5">
          <Text className="text-center text-caption text-text-secondary" numberOfLines={3}>
            {attachment.name}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
