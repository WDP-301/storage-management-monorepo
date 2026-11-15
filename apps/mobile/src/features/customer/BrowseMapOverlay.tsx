import { Crosshair, MagnifyingGlass, X } from 'phosphor-react-native';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useBookingSettings } from '../../../lib/client-settings';
import { colors, InlineMessage, Text } from '../../components/ui';

type Props = {
  searchLabel: string | null;
  nearbyCount: number | null;
  radiusKm: number | null;
  isLocating: boolean;
  error: string | null;
  selectedCount: number;
  onSearch: () => void;
  onClearSearch: () => void;
  onNearMe: () => void;
};

/** Floating controls over the map: place search, "Gần tôi" and selection/nearby badges. */
export function BrowseMapOverlay({
  searchLabel,
  nearbyCount,
  radiusKm,
  isLocating,
  error,
  selectedCount,
  onSearch,
  onClearSearch,
  onNearMe,
}: Props) {
  const { maxUnitsPerBooking } = useBookingSettings();
  return (
    <View className="absolute top-3 right-4 left-4 gap-2" pointerEvents="box-none">
      <View className="flex-row items-center gap-2">
        <View className="flex-1 flex-row items-center rounded-full border border-border-default bg-bg-card">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tìm kho gần địa điểm"
            className="min-h-11 flex-1 flex-row items-center gap-2 px-3.5"
            onPress={onSearch}
          >
            <MagnifyingGlass color={colors.semantic.iconBrand} size={18} weight="bold" />
            <Text className="flex-1 text-body-sm font-medium text-text-primary" numberOfLines={1}>
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
              <X color={colors.semantic.textSecondary} size={18} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tìm kho gần tôi"
          className="size-11 items-center justify-center rounded-full bg-action-primary"
          disabled={isLocating}
          onPress={onNearMe}
        >
          {isLocating ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Crosshair color={colors.white} size={20} weight="bold" />
          )}
        </Pressable>
      </View>
      {error ? (
        <View className="rounded-xl border border-border-default bg-bg-card px-3 py-2">
          <InlineMessage message={error} type="error" />
        </View>
      ) : null}
      {selectedCount > 0 || nearbyCount !== null ? (
        <View className="flex-row flex-wrap items-center gap-2">
          {selectedCount > 0 ? (
            <View className="rounded-full bg-bg-inverse px-3 py-2">
              <Text className="text-caption font-medium text-text-inverse tabular-nums">
                Đã chọn {selectedCount}/{maxUnitsPerBooking}
              </Text>
            </View>
          ) : null}
          {nearbyCount !== null ? (
            <View className="rounded-full border border-border-default bg-bg-card px-3 py-2">
              <Text className="text-caption font-medium text-text-primary tabular-nums">
                {nearbyCount} kho · {radiusKm} km
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
