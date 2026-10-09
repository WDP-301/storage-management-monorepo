import { Button } from 'heroui-native';
import { ActivityIndicator, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { MAX_WAREHOUSES_PER_BOOKING } from '../../../lib/warehouse-query';
import type { NearbyWarehouse, Warehouse } from '../../types/storage-api';
import { EmptyState } from './BrowseStates';
import { WarehouseCard } from './WarehouseCard';

type Props = {
  /** Nearby results carry `distanceKm`, which each card shows. */
  warehouses: readonly (Warehouse | NearbyWarehouse)[];
  /** Replaces the "N kho đang trống" line, e.g. while showing nearby results. */
  summary?: string;
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  hasFilters: boolean;
  hasHolding: boolean;
  selectedIds: readonly string[];
  onToggle: (warehouse: Warehouse) => void;
  onLoadMore: () => void;
};

/** The list half of Browse: result summary, warehouse cards and a load-more footer. */
export function BrowseResultsList({
  warehouses,
  summary,
  total,
  hasMore,
  isLoadingMore,
  hasFilters,
  hasHolding,
  selectedIds,
  onToggle,
  onLoadMore,
}: Props) {
  const prefersReducedMotion = useReducedMotion();
  const selectionFull = selectedIds.length >= MAX_WAREHOUSES_PER_BOOKING;

  return (
    <>
      <Text className="mx-4 mt-3 mb-3 font-body text-body-sm text-muted">
        {summary ?? `${total} kho đang trống`}. Chọn tối đa {MAX_WAREHOUSES_PER_BOOKING} kho cho một
        lần đặt.
      </Text>

      {warehouses.length === 0 ? (
        <EmptyState isFilteredOut={hasFilters} />
      ) : (
        <View className="gap-3 px-4">
          {warehouses.map((warehouse, index) => {
            const isSelected = selectedIds.includes(warehouse.id);
            return (
              // Staggered fade tells the customer the list changed after a filter edit.
              <Animated.View
                key={warehouse.id}
                entering={
                  prefersReducedMotion
                    ? undefined
                    : FadeInDown.duration(220).delay(Math.min(index, 5) * 45)
                }
              >
                <WarehouseCard
                  distanceKm={'distanceKm' in warehouse ? warehouse.distanceKm : undefined}
                  isDisabled={hasHolding || (selectionFull && !isSelected)}
                  isSelected={isSelected}
                  warehouse={warehouse}
                  onToggle={() => onToggle(warehouse)}
                />
              </Animated.View>
            );
          })}
        </View>
      )}

      {warehouses.length > 0 ? (
        <View className="items-center gap-3 px-4 pt-5">
          <Text className="font-body text-center text-muted text-caption">
            Hiển thị {warehouses.length} / {total} kho
          </Text>
          {isLoadingMore ? <ActivityIndicator /> : null}
          {hasMore && !isLoadingMore ? (
            <Button size="sm" variant="secondary" onPress={onLoadMore}>
              <Button.Label className="font-ui">Xem thêm</Button.Label>
            </Button>
          ) : null}
        </View>
      ) : null}
    </>
  );
}
