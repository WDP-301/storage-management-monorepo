import { useRouter } from 'expo-router';
import {
  CaretDown,
  Faders,
  MagnifyingGlass,
  MapPin,
  NavigationArrow,
  User,
  X,
} from 'phosphor-react-native';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import type { BrowseCriteria, BrowseView } from '../../types/customer';
import { BrowseViewToggle } from './BrowseViewToggle';
import type { LocationOption } from './location-options';
import type { NearbySearch } from './use-nearby-search';

const ACCENT = '#006398';
const MUTED = '#64748b';

export function BrowseBrandHeader({
  location,
  scope = 'Toàn quốc',
  onLocation,
}: {
  location: string;
  /** Muted text after the location, e.g. the radius of a nearby search. */
  scope?: string;
  onLocation: () => void;
}) {
  const router = useRouter();
  return (
    <View className="min-h-14 flex-row items-center justify-between gap-2 bg-surface px-4 py-2">
      <View className="flex-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn nơi tìm kho"
          onPress={onLocation}
        >
          <View className="flex-row items-center gap-1">
            <Text
              className="max-w-[65%] font-strong text-accent text-caption uppercase tracking-wide"
              numberOfLines={1}
            >
              {location}
            </Text>
            <CaretDown size={12} color={ACCENT} weight="fill" />
            <Text className="font-body text-caption text-muted">• {scope}</Text>
          </View>
        </Pressable>
        <Text
          className="font-strong text-foreground text-title-sm"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          Hệ Thống Thuê Kho Việt Nam
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mở tài khoản"
        hitSlop={6}
        onPress={() => router.navigate('/(customer)/settings')}
      >
        <View className="size-8 items-center justify-center rounded-full bg-black">
          <User size={18} color="white" weight="bold" />
        </View>
      </Pressable>
    </View>
  );
}

type Props = {
  location: string;
  criteria: BrowseCriteria;
  /** Warehouses with stock in the selected province, the denominator of the ward counts. */
  totalInProvince: number;
  wards: readonly LocationOption[];
  view: BrowseView;
  plottableCount: number;
  onView: (view: BrowseView) => void;
  onChange: (criteria: BrowseCriteria) => void;
  onOpenFilters: () => void;
  /** Active "Gần tôi" / place search; replaces the province as the card's answer to "where". */
  nearby: NearbySearch | null;
  isLocating: boolean;
  onOpenLocation: () => void;
  onClearNearby: () => void;
};

export function BrowseLocationControls({
  location,
  criteria,
  totalInProvince,
  wards,
  view,
  plottableCount,
  onView,
  onChange,
  onOpenFilters,
  nearby,
  isLocating,
  onOpenLocation,
  onClearNearby,
}: Props) {
  const selectedWard = wards.find((ward) => ward.code === criteria.wardCode);
  const options = [
    { code: null, name: 'Tất cả', count: totalInProvince },
    ...wards.map((ward) => ({ code: ward.code, name: ward.name, count: ward.count })),
  ];
  return (
    <View className="gap-2 px-4 pt-3">
      <View className="flex-row items-center gap-2">
        <View className="min-h-14 flex-1 flex-row items-center rounded-xl bg-surface-secondary">
          <Pressable
            className="flex-1 flex-row items-center gap-2 py-2 pl-3"
            accessibilityRole="button"
            accessibilityLabel="Chọn nơi tìm kho"
            onPress={onOpenLocation}
          >
            {isLocating ? (
              <ActivityIndicator color={ACCENT} />
            ) : nearby?.source === 'me' ? (
              <NavigationArrow size={20} color={ACCENT} weight="fill" />
            ) : nearby ? (
              <MagnifyingGlass size={20} color={ACCENT} weight="bold" />
            ) : (
              <MapPin size={20} color={ACCENT} />
            )}
            <View className="flex-1">
              <Text className="font-body text-caption text-muted" numberOfLines={1}>
                {nearby ? `≤ ${nearby.radiusKm} km` : isLocating ? 'Gần tôi' : 'Khu vực tìm kho'}
              </Text>
              <Text className="font-strong text-body-sm text-foreground" numberOfLines={1}>
                {isLocating
                  ? 'Đang lấy vị trí...'
                  : nearby
                    ? nearbyTitle(nearby)
                    : selectedWard
                      ? `${location} • ${selectedWard.name}`
                      : location}
              </Text>
            </View>
          </Pressable>
          {nearby ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bỏ tìm kho gần"
              className="h-14 w-8 items-center justify-center"
              onPress={onClearNearby}
            >
              <X size={18} color={MUTED} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở bộ lọc"
            className="h-14 w-10 items-center justify-center"
            onPress={onOpenFilters}
          >
            <Faders size={18} color={MUTED} />
          </Pressable>
        </View>
        <BrowseViewToggle view={view} onChange={onView} plottableCount={plottableCount} />
      </View>
      {wards.length > 0 && !nearby ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          {options.map((option) => {
            const selected = criteria.wardCode === option.code;
            return (
              <Pressable
                key={option.code ?? 'all'}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => onChange({ ...criteria, wardCode: option.code })}
              >
                <View
                  className={`min-h-14 w-28 items-center justify-center rounded-lg px-2 py-1.5 ${selected ? 'bg-foreground' : 'bg-surface-secondary'}`}
                >
                  <Text
                    className={`text-center font-ui text-body-sm ${selected ? 'text-accent-foreground' : 'text-subtle'}`}
                    numberOfLines={2}
                  >
                    {option.name}
                  </Text>
                  <Text
                    className={`font-body text-caption ${selected ? 'text-accent-foreground' : 'text-muted'}`}
                  >
                    {option.count} kho
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

/** "Gần bạn" for GPS, "Gần <place>" for a searched place — short enough for the area card. */
export function nearbyTitle(nearby: NearbySearch): string {
  return nearby.source === 'me' ? 'Gần bạn' : `Gần ${nearby.label}`;
}
