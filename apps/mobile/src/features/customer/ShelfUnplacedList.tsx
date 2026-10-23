import { Pressable, Text, View } from 'react-native';
import { formatMoney, formatNumber } from '../../../lib/format-vi';
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
    <View className="gap-2 rounded-xl border border-border bg-surface p-3">
      <Text className="font-strong text-body-sm text-foreground">{title}</Text>
      {shelves.map((shelf) => {
        const selected = selectedIds.includes(shelf.id);
        const available = shelf.status === 'AVAILABLE';
        const tone = selected
          ? 'border-accent bg-accent/10'
          : shelf.id === focusedId
            ? 'border-foreground bg-surface-secondary'
            : available
              ? 'border-success bg-success-bg'
              : 'border-border bg-surface-secondary';
        return (
          <Pressable
            key={shelf.id}
            accessibilityRole="button"
            accessibilityLabel={`Kệ ${shelf.code}`}
            accessibilityState={{ selected, disabled: !available && !selected }}
            onPress={() => onShelfPress(shelf.id)}
            className={`flex-row items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${tone}`}
          >
            <View className="flex-1 gap-0.5">
              <Text
                className={`font-numeric text-body-sm ${available || selected ? 'text-foreground' : 'text-muted'}`}
              >
                {shortShelfCode(shelf.code, warehouseCode)}
              </Text>
              <Text className="font-body text-caption text-muted">
                {formatNumber(shelf.areaM2)} m² · {formatMoney(shelf.monthlyPrice)}/tháng
              </Text>
            </View>
            <Text
              className={`font-ui text-caption ${selected ? 'text-accent' : available ? 'text-success' : 'text-muted'}`}
            >
              {selected ? 'Đã chọn' : (shelfStatusLabel[shelf.status] ?? shelf.status)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
