import { useRouter } from 'expo-router';
import { CaretDown, Faders, MapPin, User } from 'phosphor-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { BrowseCriteria, BrowseView, FacilityOffer } from '../../types/customer';
import { BrowseViewToggle } from './BrowseViewToggle';
import type { LocationOption } from './location-options';

const ACCENT = '#006398';
const MUTED = '#64748b';

export function BrowseBrandHeader({
  location,
  onLocation,
}: {
  location: string;
  onLocation: () => void;
}) {
  const router = useRouter();
  return (
    <View className="min-h-14 flex-row items-center justify-between gap-2 bg-surface px-4 py-2">
      <View className="flex-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn tỉnh thành"
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
            <Text className="font-body text-caption text-muted">• Toàn quốc</Text>
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
  facilities: readonly FacilityOffer[];
  wards: readonly LocationOption[];
  view: BrowseView;
  plottableCount: number;
  onView: (view: BrowseView) => void;
  onChange: (criteria: BrowseCriteria) => void;
  onOpenFilters: () => void;
};

export function BrowseLocationControls({
  location,
  criteria,
  facilities,
  wards,
  view,
  plottableCount,
  onView,
  onChange,
  onOpenFilters,
}: Props) {
  const selectedWard = wards.find((ward) => ward.code === criteria.wardCode);
  const inProvince = facilities.filter(
    (facility) => !criteria.provinceCode || facility.provinceCode === criteria.provinceCode,
  );
  const options = [
    { code: null, name: 'Tất cả', count: inProvince.length },
    ...wards.map((ward) => ({
      ...ward,
      count: inProvince.filter((facility) => facility.wardCode === ward.code).length,
    })),
  ];
  return (
    <View className="gap-2 px-4 pt-3">
      <View className="flex-row items-center gap-2">
        <Pressable
          className="flex-1"
          accessibilityRole="button"
          accessibilityLabel="Chọn khu vực và bộ lọc"
          onPress={onOpenFilters}
        >
          <View className="min-h-14 flex-row items-center gap-2 rounded-xl bg-surface-secondary px-3 py-2">
            <MapPin size={20} color={ACCENT} />
            <View className="flex-1">
              <Text className="font-body text-caption text-muted" numberOfLines={1}>
                Khu vực tìm kho
              </Text>
              <Text className="font-strong text-body-sm text-foreground" numberOfLines={1}>
                {selectedWard ? `${location} • ${selectedWard.name}` : location}
              </Text>
            </View>
            <Faders size={18} color={MUTED} />
          </View>
        </Pressable>
        <BrowseViewToggle view={view} onChange={onView} plottableCount={plottableCount} />
      </View>
      {wards.length > 0 ? (
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
                    {option.count} cơ sở
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
