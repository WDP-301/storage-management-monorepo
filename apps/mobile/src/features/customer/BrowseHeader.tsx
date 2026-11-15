import { useRouter } from 'expo-router';
import { Faders, MagnifyingGlass, MapPin, NavigationArrow, User, X } from 'phosphor-react-native';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { colors, Text } from '../../components/ui';
import type { BrowseCriteria, BrowseView } from '../../types/customer';
import { BrowseViewToggle } from './BrowseViewToggle';
import type { LocationOption } from './location-options';
import type { NearbySearch } from './use-nearby-search';

export function BrowseBrandHeader() {
  const router = useRouter();
  return (
    <View className="min-h-14 flex-row items-center justify-between gap-2 border-b border-border-default bg-bg-page px-4 py-2">
      <View className="flex-1">
        <Text
          adjustsFontSizeToFit
          className="text-subtitle font-bold text-text-brand"
          minimumFontScale={0.8}
          numberOfLines={1}
        >
          Hệ thống thuê kho Việt Nam
        </Text>
      </View>
      <Pressable
        accessibilityLabel="Mở tài khoản"
        accessibilityRole="button"
        hitSlop={6}
        onPress={() => router.navigate('/(customer)/settings')}
      >
        <View className="size-9 items-center justify-center rounded-full bg-secondary-0">
          <User color={colors.semantic.textLink} size={18} weight="bold" />
        </View>
      </Pressable>
    </View>
  );
}

type Props = {
  location: string;
  criteria: BrowseCriteria;
  wards: readonly LocationOption[];
  view: BrowseView;
  plottableCount: number;
  activeFilterCount: number;
  onView: (view: BrowseView) => void;
  onOpenFilters: () => void;
  nearby: NearbySearch | null;
  isLocating: boolean;
  onOpenLocation: () => void;
  onClearNearby: () => void;
};

export function BrowseLocationControls({
  location,
  criteria,
  wards,
  view,
  plottableCount,
  activeFilterCount,
  onView,
  onOpenFilters,
  nearby,
  isLocating,
  onOpenLocation,
  onClearNearby,
}: Props) {
  const selectedWard = wards.find((ward) => ward.code === criteria.wardCode);
  return (
    <View className="gap-2.5 bg-bg-page px-4 pt-3 pb-3">
      <View className="min-h-12 flex-row items-center rounded-2xl border border-border-default bg-bg-subtle">
        <Pressable
          accessibilityLabel="Chọn nơi tìm kho"
          accessibilityRole="button"
          className="flex-1 flex-row items-center gap-3 px-3.5 py-2.5"
          onPress={onOpenLocation}
        >
          <View className="size-9 items-center justify-center rounded-full bg-secondary-0">
            {isLocating ? (
              <ActivityIndicator color={colors.semantic.actionPrimary} size="small" />
            ) : nearby?.source === 'me' ? (
              <NavigationArrow color={colors.semantic.textLink} size={18} weight="fill" />
            ) : nearby ? (
              <MagnifyingGlass color={colors.semantic.textLink} size={18} weight="bold" />
            ) : (
              <MapPin color={colors.semantic.textLink} size={18} weight="fill" />
            )}
          </View>
          <View className="flex-1">
            <Text className="text-caption text-text-secondary" numberOfLines={1}>
              {nearby
                ? `Trong bán kính ${nearby.radiusKm} km`
                : isLocating
                  ? 'Gần tôi'
                  : 'Khu vực tìm kho'}
            </Text>
            <Text className="text-body font-semibold text-text-primary" numberOfLines={1}>
              {isLocating
                ? 'Đang lấy vị trí...'
                : nearby
                  ? nearbyTitle(nearby)
                  : selectedWard
                    ? `${location} • ${selectedWard.name}`
                    : location}
            </Text>
          </View>
          {!nearby ? (
            <Text className="text-caption font-semibold text-text-link">Thay đổi</Text>
          ) : null}
        </Pressable>
        {nearby ? (
          <Pressable
            accessibilityLabel="Bỏ tìm kho gần"
            accessibilityRole="button"
            className="h-12 w-10 items-center justify-center"
            onPress={onClearNearby}
          >
            <X color={colors.semantic.textSecondary} size={18} />
          </Pressable>
        ) : null}
      </View>

      <View className="flex-row items-center justify-between gap-2">
        <Pressable
          accessibilityLabel="Mở bộ lọc"
          accessibilityRole="button"
          className={`min-h-9 flex-row items-center gap-1.5 rounded-full border px-3.5 py-1.5 ${
            activeFilterCount > 0
              ? 'border-border-selected bg-secondary-0'
              : 'border-border-default bg-bg-subtle'
          }`}
          onPress={onOpenFilters}
          style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
        >
          <Faders
            color={activeFilterCount > 0 ? colors.semantic.textLink : colors.semantic.textSecondary}
            size={16}
            weight={activeFilterCount > 0 ? 'bold' : 'regular'}
          />
          <Text
            className={`text-caption font-semibold ${
              activeFilterCount > 0 ? 'text-text-link' : 'text-text-secondary'
            }`}
          >
            Bộ lọc
          </Text>
          {activeFilterCount > 0 ? (
            <View className="min-w-4 items-center justify-center rounded-full bg-action-primary px-1">
              <Text className="text-[10px] font-bold text-white">{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
        <BrowseViewToggle onChange={onView} plottableCount={plottableCount} view={view} />
      </View>
    </View>
  );
}

/** "Gần bạn" for GPS, "Gần <place>" for a searched place. */
export function nearbyTitle(nearby: NearbySearch): string {
  return nearby.source === 'me' ? 'Gần bạn' : `Gần ${nearby.label}`;
}
