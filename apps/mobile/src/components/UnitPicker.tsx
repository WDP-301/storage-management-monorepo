import type { ShelfItemUnit } from '@storage/types';
import { Pressable, View } from 'react-native';
import { SHELF_UNITS } from '../../lib/shelf-storage-format';
import { Text } from './ui';

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
        <Text className="text-caption text-text-secondary">{label}:</Text>
        {SHELF_UNITS.map((option) => {
          const selected = option.unit === value;
          return (
            <Pressable
              key={option.unit}
              accessibilityHint={option.hint}
              accessibilityLabel={`${label} ${option.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={`rounded-full border px-2.5 py-1 ${
                selected
                  ? 'border-action-primary bg-action-primary'
                  : 'border-border-default bg-bg-subtle'
              }`}
              onPress={() => onChange(option.unit)}
            >
              <Text
                className={`text-caption font-medium ${
                  selected ? 'text-text-inverse' : 'text-text-primary'
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {hint ? <Text className="text-caption text-text-secondary">{hint}</Text> : null}
    </View>
  );
}
