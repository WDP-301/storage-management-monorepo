import type { AbandonedShelfContractView } from '@storage/types';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatIsoDateTime } from '../../../../lib/format-vi';
import { ShelfStorageApi } from '../../../../lib/shelf-storage-api';
import { linesSummary } from '../../../../lib/shelf-storage-format';
import { ListState } from './ListState';
import { useFocusLoader } from './use-focus-loader';

/** Managers: abandoned returns that still hold goods; tapping one opens the recovery form. */
export function AbandonedShelvesList({
  warehouseId,
  onOpen,
}: {
  warehouseId: string;
  onOpen: (contract: AbandonedShelfContractView) => void;
}) {
  const fetcher = useCallback(() => ShelfStorageApi.abandonedContracts(warehouseId), [warehouseId]);
  const { data, error, loading, reload } = useFocusLoader(
    fetcher,
    'Không tải được danh sách thu hồi.',
  );
  return (
    <View className="gap-3">
      <ListState
        loading={loading}
        error={error}
        empty={!data || data.length === 0}
        emptyText="Không có kệ bỏ kho nào còn đồ cần thu hồi."
        onRetry={() => void reload()}
      />
      {data?.map((contract) => (
        <Pressable
          key={contract.contractId}
          accessibilityRole="button"
          className="gap-1 rounded-xl border border-border bg-surface p-4"
          onPress={() => onOpen(contract)}
        >
          <Text className="font-strong text-body-md text-foreground">
            {contract.customer.fullName ?? contract.customer.phone ?? '—'}
          </Text>
          <Text className="font-body text-caption text-muted">
            Kệ {contract.shelf.code} · hẹn trả{' '}
            {formatIsoDateTime(String(contract.returnScheduledAt))}
          </Text>
          <Text className="font-body text-body-sm text-foreground">
            {linesSummary(contract.items)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
