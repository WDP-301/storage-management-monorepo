import type { PickupRequestView } from '@storage/types';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { formatIsoDateTime } from '../../../../lib/format-vi';
import { useSession } from '../../../../lib/session';
import { ShelfStorageApi } from '../../../../lib/shelf-storage-api';
import {
  pickupStatusLabel,
  type RequestScope,
  requestsInScope,
  unitLabel,
} from '../../../../lib/shelf-storage-format';
import { Button, DashedDivider, InlineMessage, Text } from '../../../components/ui';
import { StatusPill } from '../../customer/contract-display';
import { shelfApiError } from '../staff-errors';
import { AssigneeFilter } from './AssigneeFilter';
import { AssigneeLine } from './AssigneeLine';
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
  const { user } = useSession();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [scope, setScope] = useState<RequestScope>('MINE');
  const shown = useMemo(
    () => requestsInScope(data ?? [], scope, user?.id),
    [data, scope, user?.id],
  );

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
      {data && data.length > 0 ? (
        <AssigneeFilter
          scope={scope}
          onChange={setScope}
          mineCount={requestsInScope(data, 'MINE', user?.id).length}
          allCount={data.length}
        />
      ) : null}
      <ListState
        loading={loading}
        error={error}
        empty={shown.length === 0}
        emptyText={
          scope === 'MINE' && (data?.length ?? 0) > 0
            ? 'Không có yêu cầu nào của bạn. Chọn "Tất cả" để xem của cả kho.'
            : 'Chưa có yêu cầu lấy đồ nào.'
        }
        onRetry={() => void reload()}
      />
      {actionError ? (
        <View className="rounded-[20px] border border-border-error/30 bg-danger-0 p-4">
          <InlineMessage message={actionError} type="error" />
        </View>
      ) : null}
      {shown.map((request) => (
        <View
          key={request.id}
          className="gap-2.5 rounded-[20px] border border-border-default bg-bg-card p-4"
        >
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-body-lg font-semibold text-text-primary">
              {request.customer.fullName ?? request.customer.phone ?? '—'}
            </Text>
            <StatusPill
              label={pickupStatusLabel(request.status)}
              tone={request.status === 'READY' ? 'success' : 'accent'}
            />
          </View>
          <Text className="text-caption text-text-secondary">
            Kệ {request.shelf.code} · hẹn lấy {formatIsoDateTime(String(request.requestedFor))}
          </Text>
          <AssigneeLine assignedTo={request.assignedTo} myId={user?.id} />
          <DashedDivider />
          {request.lines.map((line) => (
            <View key={line.itemId} className="flex-row justify-between gap-3">
              <Text className="flex-1 text-body text-text-primary">{line.name}</Text>
              <Text
                className={`font-semibold text-body tabular-nums ${
                  line.quantity > line.available ? 'text-status-danger' : 'text-text-primary'
                }`}
              >
                {line.quantity} / còn {line.available} {unitLabel(line.unit)}
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
              label={busyId === request.id ? 'Đang lưu…' : 'Đã chuẩn bị'}
              loading={busyId === request.id}
              onPress={() => void markReady(request)}
              size="sm"
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}
