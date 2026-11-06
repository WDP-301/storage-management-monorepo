import type { PickupRequestView } from '@storage/types';
import { Button } from 'heroui-native';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { formatIsoDateTime } from '../../../../lib/format-vi';
import { ShelfStorageApi } from '../../../../lib/shelf-storage-api';
import { pickupStatusLabel } from '../../../../lib/shelf-storage-format';
import { StatusPill } from '../../customer/contract-display';
import { shelfApiError } from '../staff-errors';
import { ListState } from './ListState';
import { useFocusLoader } from './use-focus-loader';

/** Open pick-up requests of the warehouse, soonest first; staff mark a pending one as prepared. */
export function WarehousePickupRequests({ warehouseId }: { warehouseId: string }) {
  const fetcher = useCallback(
    () => ShelfStorageApi.warehousePickupRequests(warehouseId),
    [warehouseId],
  );
  const { data, setData, error, loading, reload } = useFocusLoader(
    fetcher,
    'Không tải được yêu cầu lấy đồ.',
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const markReady = async (request: PickupRequestView) => {
    setBusyId(request.id);
    setActionError(null);
    try {
      const updated = await ShelfStorageApi.markPickupReady(request.id);
      setData((list) => list?.map((r) => (r.id === updated.id ? updated : r)) ?? list);
    } catch (cause) {
      setActionError(shelfApiError(cause, 'Không đánh dấu được yêu cầu.'));
      void reload();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View className="gap-3">
      <ListState
        loading={loading}
        error={error}
        empty={!data || data.length === 0}
        emptyText="Chưa có yêu cầu lấy đồ nào."
        onRetry={() => void reload()}
      />
      {actionError ? (
        <Text className="rounded-xl bg-danger-bg p-3 font-body text-body-sm text-danger">
          {actionError}
        </Text>
      ) : null}
      {data?.map((request) => (
        <View key={request.id} className="gap-2 rounded-xl border border-border bg-surface p-4">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 font-strong text-body-md text-foreground">
              {request.customer.fullName ?? request.customer.phone ?? '—'}
            </Text>
            <StatusPill
              label={pickupStatusLabel(request.status)}
              tone={request.status === 'READY' ? 'success' : 'accent'}
            />
          </View>
          <Text className="font-body text-caption text-muted">
            Kệ {request.shelf.code} · hẹn lấy {formatIsoDateTime(String(request.requestedFor))}
          </Text>
          {request.lines.map((line) => (
            <View key={line.itemId} className="flex-row justify-between gap-3">
              <Text className="flex-1 font-body text-body-sm text-foreground">{line.name}</Text>
              <Text
                className={`font-strong text-body-sm ${line.quantity > line.available ? 'text-danger' : 'text-foreground'}`}
              >
                {line.quantity} / còn {line.available}
              </Text>
            </View>
          ))}
          {request.note ? (
            <Text className="font-body text-body-sm text-muted">Ghi chú: {request.note}</Text>
          ) : null}
          {request.status === 'PENDING' ? (
            <Button
              size="sm"
              isDisabled={busyId === request.id}
              onPress={() => void markReady(request)}
            >
              <Button.Label>{busyId === request.id ? 'Đang lưu…' : 'Đã chuẩn bị'}</Button.Label>
            </Button>
          ) : null}
        </View>
      ))}
    </View>
  );
}
