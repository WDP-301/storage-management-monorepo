import { Pressable, View } from 'react-native';
import { formatMoney, formatNumber } from '../../../lib/format-vi';
import { StatusPill, Text } from '../../components/ui';
import type { Warehouse } from '../../types/storage-api';
import { shelfStatusLabel, shortShelfCode } from './shelf-display';

/** Shelves without a place on the floor plan, as tappable rows (same select/focus rules as the map). */
export function ShelfUnplacedList({
  title,
  shelves,
  warehouseCode,
  selectedIds,
  focusedId,
  onShelfPress,
}: {
  title: string;
  shelves: Warehouse[];
  warehouseCode: string;
  selectedIds: readonly string[];
  focusedId: string | null;
  onShelfPress: (id: string) => void;
}) {
  return (
    <View className="gap-2.5 rounded-[20px] border border-border-default bg-bg-card p-4">
      <Text className="text-body-md font-semibold text-text-primary">{title}</Text>
      {shelves.map((shelf) => {
        const selected = selectedIds.includes(shelf.id);
        const available = shelf.status === 'AVAILABLE';
        const tone = selected
          ? 'border-border-selected bg-secondary-0'
          : shelf.id === focusedId
            ? 'border-border-focus bg-bg-subtle'
            : available
              ? 'border-success-200 bg-success-0'
              : 'border-border-default bg-bg-subtle';
        return (
          <Pressable
            key={shelf.id}
            accessibilityRole="button"
            accessibilityLabel={`Kệ ${shelf.code}`}
            accessibilityState={{ selected, disabled: !available && !selected }}
            onPress={() => onShelfPress(shelf.id)}
            className={`flex-row items-center justify-between gap-3 rounded-xl border px-3.5 py-3 ${tone}`}
          >
            <View className="flex-1 gap-0.5">
              <Text
                className={`text-body-sm font-semibold tabular-nums ${
                  available || selected ? 'text-text-primary' : 'text-text-secondary'
                }`}
              >
                {shortShelfCode(shelf.code, warehouseCode)}
              </Text>
              <Text className="text-caption text-text-secondary tabular-nums">
                {formatNumber(shelf.areaM2)} m² · {formatMoney(shelf.monthlyPrice)}/tháng
              </Text>
            </View>
            <StatusPill
              label={selected ? 'Đã chọn' : (shelfStatusLabel[shelf.status] ?? shelf.status)}
              tone={selected ? 'info' : available ? 'success' : 'neutral'}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
