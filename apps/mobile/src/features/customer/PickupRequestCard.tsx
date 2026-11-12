import type { PickupRequestView } from '@storage/types';
import { Button } from 'heroui-native';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { ApiError } from '../../../lib/api';
import { formatIsoDateTime } from '../../../lib/format-vi';
import { ShelfStorageApi } from '../../../lib/shelf-storage-api';
import { pickupStatusLabel, shelfErrorMessage } from '../../../lib/shelf-storage-format';
import { StatusPill, type StatusTone } from './contract-display';

const TONE: Record<PickupRequestView['status'], StatusTone> = {
  PENDING: 'warning',
  READY: 'success',
  COMPLETED: 'neutral',
  CANCELLED: 'neutral',
};

/** One pick-up request; the open one (`onCancelled` given) can be cancelled by the customer. */
export function PickupRequestCard({
  request,
  onCancelled,
}: {
  request: PickupRequestView;
  onCancelled?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await ShelfStorageApi.cancelPickupRequest(request.id);
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
  const confirmCancel = () =>
    Alert.alert('Hủy yêu cầu lấy đồ?', 'Nhân viên sẽ không chuẩn bị đồ cho yêu cầu này nữa.', [
      { text: 'Giữ lại', style: 'cancel' },
      { text: 'Hủy yêu cầu', style: 'destructive', onPress: () => void cancel() },
    ]);

  return (
    <View className="gap-2 rounded-lg border border-border bg-surface-secondary p-3">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 font-strong text-body-sm text-foreground">
          Lấy lúc {formatIsoDateTime(String(request.requestedFor))}
        </Text>
        <StatusPill label={pickupStatusLabel(request.status)} tone={TONE[request.status]} />
      </View>
      {request.lines.map((line) => (
        <View key={line.itemId} className="flex-row items-center justify-between gap-3">
          <Text className="flex-1 font-body text-body-sm text-foreground">{line.name}</Text>
          <Text className="font-strong text-body-sm text-foreground">×{line.quantity}</Text>
        </View>
      ))}
      {request.note ? (
        <Text className="font-body text-body-sm text-muted">Ghi chú: {request.note}</Text>
      ) : null}
      {request.status === 'READY' ? (
        <Text className="font-body text-caption text-muted">Tới quầy, đưa mã gửi / lấy đồ.</Text>
      ) : null}
      {error ? <Text className="font-body text-body-sm text-danger">{error}</Text> : null}
      {onCancelled ? (
        <Button isDisabled={busy} variant="danger-soft" onPress={confirmCancel}>
          <Button.Label>{busy ? 'Đang hủy…' : 'Hủy yêu cầu'}</Button.Label>
        </Button>
      ) : null}
    </View>
  );
}
