import { Button } from 'heroui-native';
import { Text, View } from 'react-native';
import { formatMoney, formatNumber } from '../../../lib/format-vi';
import { MAX_WAREHOUSES_PER_BOOKING } from '../../../lib/warehouse-query';
import type { Warehouse } from '../../types/storage-api';

type Props = {
  selected: readonly Warehouse[];
  hasHolding: boolean;
  onContinue: () => void;
  onClear: () => void;
};

/**
 * Pinned summary of the warehouses picked so far.
 *
 * Lives outside the scroll area because it is the running answer to "what have I picked" — area,
 * rent and progress — while the customer keeps scrolling through the list.
 */
export function BrowseSelectionBar({ selected, hasHolding, onContinue, onClear }: Props) {
  const totalArea = selected.reduce((sum, warehouse) => sum + warehouse.areaM2, 0);
  const totalRent = selected.reduce((sum, warehouse) => sum + warehouse.monthlyPrice, 0);

  return (
    <View className="shrink-0 border-border border-t bg-surface px-4 py-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="font-strong text-body-sm text-foreground" numberOfLines={1}>
            Đã chọn {selected.length}/{MAX_WAREHOUSES_PER_BOOKING} kho
          </Text>
          <View className="flex-row items-baseline gap-1">
            <Text className="font-body text-caption text-muted">
              Tổng {formatNumber(totalArea)} m²
            </Text>
            <Text className="font-numeric text-accent text-num-sm">{formatMoney(totalRent)}</Text>
            <Text className="font-body text-caption text-muted">/tháng</Text>
          </View>
        </View>

        {/* Picks hidden by a filter or taken since have no card left to untick. */}
        <Button variant="ghost" onPress={onClear}>
          <Button.Label className="font-ui">Bỏ chọn</Button.Label>
        </Button>
        <Button isDisabled={hasHolding} onPress={onContinue}>
          <Button.Label className="font-ui">Tiếp tục</Button.Label>
        </Button>
      </View>
    </View>
  );
}
