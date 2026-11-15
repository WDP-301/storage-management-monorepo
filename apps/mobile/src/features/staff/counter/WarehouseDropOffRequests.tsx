import type { DropOffRequestView } from '@storage/types';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { formatIsoDateTime } from '../../../../lib/format-vi';
import { ShelfStorageApi } from '../../../../lib/shelf-storage-api';
import { dropOffStatusLabel, quantityWithUnit } from '../../../../lib/shelf-storage-format';
import { Button, DashedDivider, InlineMessage, Text } from '../../../components/ui';
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
        empty={!data || data.length === 0}
        emptyText="Chưa có yêu cầu gửi đồ nào."
        error={error}
        loading={loading}
        onRetry={() => void reload()}
      />
      {actionError ? (
        <View className="rounded-[20px] border border-border-error/30 bg-danger-0 p-4">
          <InlineMessage message={actionError} type="error" />
        </View>
      ) : null}
      {data?.map((request) => (
        <View
          key={request.id}
          className="gap-2.5 rounded-[20px] border border-border-default bg-bg-card p-4"
        >
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-body-lg font-semibold text-text-primary">
              {request.customer.fullName ?? request.customer.phone ?? '—'}
            </Text>
            <StatusPill
              label={dropOffStatusLabel(request.status)}
              tone={request.status === 'CONFIRMED' ? 'success' : 'accent'}
            />
          </View>
          <Text className="text-caption text-text-secondary">
            Kệ {request.shelf.code} · hẹn gửi {formatIsoDateTime(String(request.requestedFor))}
          </Text>
          <DashedDivider />
          {request.lines.map((line) => (
            <View
              key={line.itemId ?? `new:${line.name}`}
              className="flex-row justify-between gap-3"
            >
              <Text className="flex-1 text-body text-text-primary">
                {line.name}
                {line.itemId ? '' : ' (món mới)'}
              </Text>
              <Text className="font-semibold text-body text-text-primary tabular-nums">
                ×{quantityWithUnit(line.quantity, line.unit)}
              </Text>
            </View>
          ))}
          {request.note ? (
            <Text className="text-body text-text-secondary">Ghi chú: {request.note}</Text>
          ) : null}
          {request.status === 'PENDING' ? (
            <Button
              disabled={busyId === request.id}
              fullWidth
              label={busyId === request.id ? 'Đang lưu…' : 'Xác nhận'}
              loading={busyId === request.id}
              onPress={() => void confirm(request)}
              size="sm"
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}
