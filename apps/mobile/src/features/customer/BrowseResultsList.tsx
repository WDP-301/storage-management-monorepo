import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useBookingSettings } from '../../../lib/client-settings';
import { isShelfWarehouse } from '../../../lib/shelf-rental';
import { Button, colors, Text } from '../../components/ui';
import type { NearbyWarehouse, Warehouse } from '../../types/storage-api';
import { EmptyState } from './BrowseStates';
import { WarehouseCard } from './WarehouseCard';

type Props = {
  warehouses: readonly (Warehouse | NearbyWarehouse)[];
  summary?: string;
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  hasFilters: boolean;
  hasHolding: boolean;
  selectedIds: readonly string[];
  onToggle: (warehouse: Warehouse) => void;
  onOpen: (warehouse: Warehouse | NearbyWarehouse) => void;
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
  onOpen,
  onLoadMore,
}: Props) {
  const prefersReducedMotion = useReducedMotion();
  const { maxUnitsPerBooking } = useBookingSettings();
  const selectionFull = selectedIds.length >= maxUnitsPerBooking;

  return (
    <>
      <Text className="mx-4 mt-3 mb-3 text-caption font-medium text-text-secondary">
        {summary ?? `${total} kho đang trống`} • Chọn tối đa {maxUnitsPerBooking} vị trí cho một lần
        đặt
      </Text>

      {warehouses.length === 0 ? (
        <EmptyState isFilteredOut={hasFilters} />
      ) : (
        <View className="gap-3 px-4">
          {warehouses.map((warehouse, index) => {
            const isSelected = selectedIds.includes(warehouse.id);
            return (
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
                  onOpen={() => onOpen(warehouse)}
                  onToggle={() =>
                    isShelfWarehouse(warehouse) ? onOpen(warehouse) : onToggle(warehouse)
                  }
                  warehouse={warehouse}
                />
              </Animated.View>
            );
          })}
        </View>
      )}

      {warehouses.length > 0 ? (
        <View className="items-center gap-3 px-4 pt-5">
          <Text className="text-center text-caption text-text-secondary">
            Hiển thị {warehouses.length} / {total} kho
          </Text>
          {isLoadingMore ? <ActivityIndicator color={colors.semantic.actionPrimary} /> : null}
          {hasMore && !isLoadingMore ? (
            <Button
              className="self-center"
              fullWidth={false}
              label="Xem thêm kho"
              onPress={onLoadMore}
              size="sm"
              variant="secondary"
            />
          ) : null}
        </View>
      ) : null}
    </>
  );
}
