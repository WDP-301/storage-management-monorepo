import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import type { DropOffRequestView } from '@storage/types';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '../../../lib/api';
import { formatIsoDateTime } from '../../../lib/format-vi';
import { ShelfStorageApi } from '../../../lib/shelf-storage-api';
import {
  dropOffStatusLabel,
  quantityWithUnit,
  shelfErrorMessage,
} from '../../../lib/shelf-storage-format';
import { AlertSheet, Button, InlineMessage, Text } from '../../components/ui';
import { StatusPill, type StatusTone } from './contract-display';

const TONE: Record<DropOffRequestView['status'], StatusTone> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  COMPLETED: 'neutral',
  CANCELLED: 'neutral',
};

/** One drop-off request; the open one (`onCancelled` given) can be cancelled by the customer. */
export function DropOffRequestCard({
  request,
  onCancelled,
}: {
  request: DropOffRequestView;
  onCancelled?: () => void;
}) {
  const confirmRef = useRef<BottomSheetModal>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async () => {
    confirmRef.current?.dismiss();
    setBusy(true);
    setError(null);
    try {
      await ShelfStorageApi.cancelDropOffRequest(request.id);
      onCancelled?.();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? shelfErrorMessage(cause.code, cause.details, cause.message)
          : 'Không hủy được yêu cầu.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-2 rounded-2xl border border-border-default bg-bg-subtle p-3.5">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-body-sm font-semibold text-text-primary tabular-nums">
          Gửi lúc {formatIsoDateTime(String(request.requestedFor))}
        </Text>
        <StatusPill label={dropOffStatusLabel(request.status)} tone={TONE[request.status]} />
      </View>
      {request.lines.map((line) => (
        <View
          key={line.itemId ?? `new:${line.name}`}
          className="flex-row items-center justify-between gap-3"
        >
          <Text className="flex-1 text-body-sm text-text-primary">
            {line.name}
            {line.itemId ? '' : ' (mới)'}
          </Text>
          <Text className="text-body-sm font-semibold text-text-primary tabular-nums">
            ×{quantityWithUnit(line.quantity, line.unit)}
          </Text>
        </View>
      ))}
      {request.note ? (
        <Text className="text-body-sm text-text-secondary">Ghi chú: {request.note}</Text>
      ) : null}
      {request.status === 'CONFIRMED' ? (
        <Text className="text-caption text-text-secondary">Tới quầy, đưa mã gửi / lấy đồ.</Text>
      ) : null}
      {error ? <InlineMessage message={error} type="error" /> : null}
      {onCancelled ? (
        <Button
          disabled={busy}
          label={busy ? 'Đang hủy…' : 'Hủy yêu cầu'}
          loading={busy}
          onPress={() => confirmRef.current?.present()}
          size="sm"
          variant="destructive"
        />
      ) : null}

      <AlertSheet
        ref={confirmRef}
        destructive
        message="Kho sẽ được báo là bạn không mang đồ tới nữa."
        onPrimary={() => void cancel()}
        onSecondary={() => confirmRef.current?.dismiss()}
        primaryLabel="Hủy yêu cầu"
        secondaryLabel="Giữ lại"
        title="Hủy yêu cầu gửi đồ?"
      />
    </View>
  );
}
