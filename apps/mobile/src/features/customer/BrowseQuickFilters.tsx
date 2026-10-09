import { Pressable, ScrollView, Text, View } from 'react-native';
import { AREA_PRESETS } from '../../../lib/warehouse-query';
import type { BrowseCriteria } from '../../types/customer';

type Props = { criteria: BrowseCriteria; onChange: (criteria: BrowseCriteria) => void };

/** One-tap area presets under the header; volume, price and sort live in the filter sheet. */
export function BrowseQuickFilters({ criteria, onChange }: Props) {
  return (
    <View className="flex-row items-center gap-1.5 pt-3 pb-2 pl-4">
      <Text className="font-body text-caption text-muted">Diện tích:</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'center', gap: 6, paddingRight: 16 }}
      >
        {AREA_PRESETS.map((preset) => {
          const selected = criteria.areaPreset === preset.key;
          return (
            <Pressable
              key={preset.key}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              className="py-1.5"
              onPress={() => onChange({ ...criteria, areaPreset: preset.key })}
            >
              <View
                className={`rounded-full px-2.5 py-1 ${selected ? 'bg-foreground' : 'bg-surface-secondary'}`}
              >
                <Text
                  className={`font-ui text-caption ${selected ? 'text-accent-foreground' : 'text-subtle'}`}
                >
                  {preset.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
