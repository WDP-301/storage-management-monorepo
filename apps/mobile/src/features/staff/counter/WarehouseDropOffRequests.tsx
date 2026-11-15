import type { DropOffRequestView } from '@storage/types';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { formatIsoDateTime } from '../../../../lib/format-vi';
import { useSession } from '../../../../lib/session';
import { ShelfStorageApi } from '../../../../lib/shelf-storage-api';
import {
  dropOffStatusLabel,
  quantityWithUnit,
  type RequestScope,
  requestsInScope,
} from '../../../../lib/shelf-storage-format';
import { Button, DashedDivider, InlineMessage, Text } from '../../../components/ui';
import { StatusPill } from '../../customer/contract-display';
import { shelfApiError } from '../staff-errors';
import { AssigneeFilter } from './AssigneeFilter';
import { AssigneeLine } from './AssigneeLine';
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
  const { user } = useSession();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [scope, setScope] = useState<RequestScope>('MINE');
  const shown = useMemo(
    () => requestsInScope(data ?? [], scope, user?.id),
    [data, scope, user?.id],
  );

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
            : 'Chưa có yêu cầu gửi đồ nào.'
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
              label={dropOffStatusLabel(request.status)}
              tone={request.status === 'CONFIRMED' ? 'success' : 'accent'}
            />
          </View>
          <Text className="text-caption text-text-secondary">
            Kệ {request.shelf.code} · hẹn gửi {formatIsoDateTime(String(request.requestedFor))}
          </Text>
          <AssigneeLine assignedTo={request.assignedTo} myId={user?.id} />
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
