import type { DropOffRequestView } from '@storage/types';
import { Button } from 'heroui-native';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { formatIsoDateTime } from '../../../../lib/format-vi';
import { ShelfStorageApi } from '../../../../lib/shelf-storage-api';
import { dropOffStatusLabel } from '../../../../lib/shelf-storage-format';
import { StatusPill } from '../../customer/contract-display';
import { shelfApiError } from '../staff-errors';
import { ListState } from './ListState';
import { useFocusLoader } from './use-focus-loader';

/** Open drop-off requests of the warehouse, soonest first; staff confirm a pending one. */
export function WarehouseDropOffRequests({ warehouseId }: { warehouseId: string }) {
  const fetcher = useCallback(
    () => ShelfStorageApi.warehouseDropOffRequests(warehouseId),
    [warehouseId],
  );
  const { data, setData, error, loading, reload } = useFocusLoader(
    fetcher,
    'Không tải được yêu cầu gửi đồ.',
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const confirm = async (request: DropOffRequestView) => {
    setBusyId(request.id);
    setActionError(null);
    try {
      const updated = await ShelfStorageApi.confirmDropOffRequest(request.id);
      setData((list) => list?.map((r) => (r.id === updated.id ? updated : r)) ?? list);
    } catch (cause) {
      setActionError(shelfApiError(cause, 'Không xác nhận được yêu cầu.'));
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
        emptyText="Chưa có yêu cầu gửi đồ nào."
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
              label={dropOffStatusLabel(request.status)}
              tone={request.status === 'CONFIRMED' ? 'success' : 'accent'}
            />
          </View>
          <Text className="font-body text-caption text-muted">
            Kệ {request.shelf.code} · hẹn gửi {formatIsoDateTime(String(request.requestedFor))}
          </Text>
          {request.lines.map((line) => (
            <View
              key={line.itemId ?? `new:${line.name}`}
              className="flex-row justify-between gap-3"
            >
              <Text className="flex-1 font-body text-body-sm text-foreground">
                {line.name}
                {line.itemId ? '' : ' (món mới)'}
              </Text>
              <Text className="font-strong text-body-sm text-foreground">×{line.quantity}</Text>
            </View>
          ))}
          {request.note ? (
            <Text className="font-body text-body-sm text-muted">Ghi chú: {request.note}</Text>
          ) : null}
          {request.status === 'PENDING' ? (
            <Button
              size="sm"
              isDisabled={busyId === request.id}
              onPress={() => void confirm(request)}
            >
              <Button.Label>{busyId === request.id ? 'Đang lưu…' : 'Xác nhận'}</Button.Label>
            </Button>
          ) : null}
        </View>
      ))}
    </View>
  );
}
