import type { AbandonedShelfContractView } from '@storage/types';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { formatIsoDateTime } from '../../../../lib/format-vi';
import { ShelfStorageApi } from '../../../../lib/shelf-storage-api';
import { linesSummary } from '../../../../lib/shelf-storage-format';
import { DashedDivider, Text } from '../../../components/ui';
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
        empty={!data || data.length === 0}
        emptyText="Không có kệ bỏ kho nào còn đồ cần thu hồi."
        error={error}
        loading={loading}
        onRetry={() => void reload()}
      />
      {data?.map((contract) => (
        <Pressable
          key={contract.contractId}
          accessibilityRole="button"
          className="gap-2 rounded-[20px] border border-border-default bg-bg-card p-4"
          onPress={() => onOpen(contract)}
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <View className="gap-0.5">
            <Text className="text-body-lg font-semibold text-text-primary">
              {contract.customer.fullName ?? contract.customer.phone ?? '—'}
            </Text>
            <Text className="text-caption text-text-secondary">
              Kệ {contract.shelf.code} · hẹn trả{' '}
              {formatIsoDateTime(String(contract.returnScheduledAt))}
            </Text>
          </View>
          <DashedDivider />
          <Text className="text-body text-text-primary">{linesSummary(contract.items)}</Text>
        </Pressable>
      ))}
    </View>
  );
}
