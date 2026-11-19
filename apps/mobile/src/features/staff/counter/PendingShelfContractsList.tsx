import type { PendingShelfContractView } from '@storage/types';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { formatIsoDate } from '../../../../lib/format-vi';
import { vietnamDayIso } from '../../../../lib/settlement-format';
import { ShelfStorageApi } from '../../../../lib/shelf-storage-api';
import { DashedDivider, StatusPill, Text } from '../../../components/ui';
import { ListState } from './ListState';
import { useFocusLoader } from './use-focus-loader';

/**
 * Shelf contracts still waiting for signed files or the first month — the customer's first visit
 * has no QR yet, so staff open the contract from here; it activates once both are in.
 */
export function PendingShelfContractsList({
  warehouseId,
  onOpen,
}: {
  warehouseId: string;
  onOpen: (contract: PendingShelfContractView) => void;
}) {
  const fetcher = useCallback(() => ShelfStorageApi.pendingContracts(warehouseId), [warehouseId]);
  const { data, error, loading, reload } = useFocusLoader(
    fetcher,
    'Không tải được danh sách kệ chờ kích hoạt.',
  );
  return (
    <View className="gap-3">
      <ListState
        empty={!data || data.length === 0}
        emptyText="Không có kệ nào chờ kích hoạt."
        error={error}
        loading={loading}
        onRetry={() => void reload()}
      />
      {data?.map((contract) => {
        const startDay = vietnamDayIso(String(contract.effectiveAt));
        return (
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
                Kệ {contract.shelf.code} · bắt đầu {startDay ? formatIsoDate(startDay) : '—'}
              </Text>
            </View>
            <DashedDivider />
            <View className="flex-row flex-wrap gap-2">
              <StatusPill
                label={contract.hasSignedFiles ? 'Đã có hợp đồng ký' : 'Chưa có hợp đồng ký'}
                tone={contract.hasSignedFiles ? 'success' : 'warning'}
              />
              <StatusPill
                label={contract.firstRentPaid ? 'Đã trả tháng đầu' : 'Chưa trả tháng đầu'}
                tone={contract.firstRentPaid ? 'success' : 'warning'}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
