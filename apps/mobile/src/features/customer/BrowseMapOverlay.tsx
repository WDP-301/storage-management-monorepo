import { Faders, MagnifyingGlass, X } from 'phosphor-react-native';
import { Pressable, Text, View } from 'react-native';
import { MAX_WAREHOUSES_PER_BOOKING } from '../../../lib/warehouse-query';

type Props = {
  searchLabel: string | null;
  nearbyCount: number | null;
  activeFilterCount: number;
  selectedCount: number;
  onSearch: () => void;
  onClearSearch: () => void;
  onOpenFilters: () => void;
};

/** Floating controls over the map: place search, filter shortcut and selection/nearby badges. */
export function BrowseMapOverlay({
  searchLabel,
  nearbyCount,
  activeFilterCount,
  selectedCount,
  onSearch,
  onClearSearch,
  onOpenFilters,
}: Props) {
  return (
    <View className="absolute top-3 right-4 left-4 gap-2" pointerEvents="box-none">
      <View className="flex-row items-center rounded-full border border-border bg-surface shadow-sm">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tìm kho gần địa điểm"
          className="min-h-11 flex-1 flex-row items-center gap-2 px-3"
          onPress={onSearch}
        >
          <MagnifyingGlass color="#006398" size={18} weight="bold" />
          <Text className="flex-1 font-ui text-body-sm text-foreground" numberOfLines={1}>
            {searchLabel ?? 'Tìm kho gần địa điểm...'}
          </Text>
        </Pressable>
        {searchLabel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xóa địa điểm tìm kiếm"
            className="size-11 items-center justify-center"
            onPress={onClearSearch}
          >
            <X color="#64748b" size={18} />
          </Pressable>
        ) : null}
      </View>
      <View className="flex-row flex-wrap items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Lọc bản đồ, ${activeFilterCount} bộ lọc đang bật`}
          className="self-start flex-row items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 shadow-sm"
          onPress={onOpenFilters}
        >
          <Faders color="#006398" size={17} weight="bold" />
          <Text className="font-ui text-body-sm text-foreground">
            {activeFilterCount > 0 ? `Bộ lọc · ${activeFilterCount}` : 'Bộ lọc'}
          </Text>
        </Pressable>
        {selectedCount > 0 ? (
          <Text className="rounded-full bg-foreground px-2.5 py-2 font-ui text-caption text-surface">
            Đã chọn {selectedCount}/{MAX_WAREHOUSES_PER_BOOKING}
          </Text>
        ) : null}
        {nearbyCount !== null ? (
          <Text className="rounded-full bg-surface px-2.5 py-2 font-ui text-caption text-foreground">
            {nearbyCount} kho · 5 km
          </Text>
        ) : null}
      </View>
    </View>
  );
}
