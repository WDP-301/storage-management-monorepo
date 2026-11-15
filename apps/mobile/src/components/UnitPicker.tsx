import type { ShelfItemUnit } from '@storage/types';
import { Pressable, Text, View } from 'react-native';
import { SHELF_UNITS } from '../../lib/shelf-storage-format';

/**
 * One chip per unit; the chosen one is filled and its hint shows below, so staff new to the
 * counter pick the same unit for the same kind of goods.
 */
export function UnitPicker({
  value,
  onChange,
  label = 'Đơn vị',
}: {
  value: ShelfItemUnit;
  onChange: (unit: ShelfItemUnit) => void;
  label?: string;
}) {
  const hint = SHELF_UNITS.find((option) => option.unit === value)?.hint;
  return (
    <View className="gap-1">
      <View className="flex-row flex-wrap items-center gap-1.5">
        <Text className="font-ui text-caption text-muted">{label}:</Text>
        {SHELF_UNITS.map((option) => {
          const selected = option.unit === value;
          return (
            <Pressable
              key={option.unit}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${option.label}`}
              accessibilityHint={option.hint}
              accessibilityState={{ selected }}
              className={`rounded-full border px-2.5 py-1 ${selected ? 'border-accent bg-accent' : 'border-border bg-surface-secondary'}`}
              onPress={() => onChange(option.unit)}
            >
              <Text
                className={`font-ui text-caption ${selected ? 'text-white' : 'text-foreground'}`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {hint ? <Text className="font-body text-caption text-muted">{hint}</Text> : null}
    </View>
  );
}
