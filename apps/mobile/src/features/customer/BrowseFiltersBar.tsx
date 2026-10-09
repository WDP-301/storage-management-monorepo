import { Buildings, Check } from 'phosphor-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { BrowseCriteria } from '../../types/customer';
import { AREA_PRESETS, MAX_UNITS_PER_BOOKING } from './browse-filters';

type Props = { criteria: BrowseCriteria; onChange: (criteria: BrowseCriteria) => void };
const QUANTITIES = Array.from({ length: MAX_UNITS_PER_BOOKING }, (_, index) => index + 1);

export function BrowseFiltersBar({ criteria, onChange }: Props) {
  return (
    <View className="gap-2 pt-3 pb-2">
      <View className="mx-4 gap-1.5 rounded-xl bg-surface-secondary p-2">
        <View className="flex-row flex-wrap items-center justify-between gap-1">
          <Text className="font-strong text-body-sm text-foreground">
            Số kho cần thuê đồng thời:
          </Text>
          <View className="flex-row items-center gap-1 rounded-full bg-success-bg px-2 py-0.5">
            <Buildings size={11} color="#059669" />
            <Text className="font-ui text-[10px] text-success">Ưu tiên cùng tòa nhà</Text>
          </View>
        </View>
        <View className="flex-row gap-1">
          {QUANTITIES.map((quantity) => {
            const selected = criteria.requestedQuantity === quantity;
            return (
              <Pressable
                key={quantity}
                className="flex-1"
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${quantity} kho`}
                onPress={() => onChange({ ...criteria, requestedQuantity: quantity })}
              >
                <View
                  className={`min-h-9 flex-row items-center justify-center gap-1 rounded-lg py-2 ${selected ? 'bg-foreground' : 'bg-surface'}`}
                >
                  {selected ? <Check size={13} color="white" weight="bold" /> : null}
                  <Text
                    className={`font-ui text-body-sm ${selected ? 'text-accent-foreground' : 'text-subtle'}`}
                  >
                    {quantity} kho
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View className="flex-row items-center gap-1.5 pl-4">
        <Text className="font-body text-caption text-muted">Kích thước:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ alignItems: 'center', gap: 6, paddingRight: 16 }}
        >
          {AREA_PRESETS.map((preset) => {
            const selected = criteria.areaPreset === preset.key;
            const label =
              preset.key === 'small'
                ? 'Nhỏ (≤ 3 m²)'
                : preset.key === 'medium'
                  ? 'Vừa (3 – 6 m²)'
                  : preset.key === 'large'
                    ? 'Lớn (> 6 m²)'
                    : preset.label;
            return (
              <Pressable
                key={preset.key}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => onChange({ ...criteria, areaPreset: preset.key })}
                className="py-1.5"
              >
                <View
                  className={`rounded-full px-2.5 py-1 ${selected ? 'bg-foreground' : 'bg-surface-secondary'}`}
                >
                  <Text
                    className={`font-ui text-caption ${selected ? 'text-accent-foreground' : 'text-subtle'}`}
                  >
                    {label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
