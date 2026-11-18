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
  isAvailable = (shelf) => shelf.status === 'AVAILABLE',
  currentId = null,
}: {
  title: string;
  shelves: Warehouse[];
  warehouseCode: string;
  selectedIds: readonly string[];
  focusedId: string | null;
  onShelfPress: (id: string) => void;
  /** Which shelves can be picked; defaults to status AVAILABLE. */
  isAvailable?: (shelf: Warehouse) => boolean;
  /** The customer's own shelf (shelf-change form), labelled instead of its status. */
  currentId?: string | null;
}) {
  return (
    <View className="gap-2.5 rounded-[20px] border border-border-default bg-bg-card p-4">
      <Text className="text-body-md font-semibold text-text-primary">{title}</Text>
      {shelves.map((shelf) => {
        const selected = selectedIds.includes(shelf.id);
        const available = isAvailable(shelf);
        const current = shelf.id === currentId;
        const tone = selected
          ? 'border-border-selected bg-secondary-0'
          : shelf.id === focusedId
            ? 'border-border-focus bg-bg-subtle'
            : current
              ? 'border-warning-600 bg-warning-0'
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
                  available || selected || current ? 'text-text-primary' : 'text-text-secondary'
                }`}
              >
                {shortShelfCode(shelf.code, warehouseCode)}
              </Text>
              <Text className="text-caption text-text-secondary tabular-nums">
                {formatNumber(shelf.areaM2)} m² · {formatMoney(shelf.monthlyPrice)}/tháng
              </Text>
            </View>
            <StatusPill
              label={
                selected
                  ? 'Đã chọn'
                  : current
                    ? 'Kệ hiện tại'
                    : available
                      ? 'Còn trống'
                      : shelf.status === 'AVAILABLE'
                        ? 'Không khả dụng'
                        : (shelfStatusLabel[shelf.status] ?? shelf.status)
              }
              tone={selected ? 'info' : current ? 'warning' : available ? 'success' : 'neutral'}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
