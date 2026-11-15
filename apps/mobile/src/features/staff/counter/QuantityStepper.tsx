import { Pressable, TextInput, View } from 'react-native';
import { Text } from '../../../components/ui';

/** − [qty] + control; the field also takes a typed number, and `max` caps both. */
export function QuantityStepper({
  value,
  max,
  onChange,
}: {
  value: number;
  max?: number;
  onChange: (quantity: number) => void;
}) {
  const stepButton = (label: string, disabled: boolean, next: number) => (
    <Pressable
      accessibilityLabel={label === '−' ? 'Giảm' : 'Tăng'}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`size-9 items-center justify-center rounded-xl border border-border-default bg-bg-subtle ${disabled ? 'opacity-40' : ''}`}
      disabled={disabled}
      onPress={() => onChange(next)}
      style={({ pressed }) => ({ opacity: pressed && !disabled ? 0.7 : disabled ? 0.4 : 1 })}
    >
      <Text className="text-body-lg font-semibold text-text-primary">{label}</Text>
    </Pressable>
  );
  return (
    <View className="flex-row items-center gap-1.5">
      {stepButton('−', value <= 0, value - 1)}
      <TextInput
        accessibilityLabel="Số lượng"
        className="h-9 w-14 rounded-xl border border-border-default bg-bg-page text-center font-inter text-body font-semibold text-text-primary"
        keyboardType="number-pad"
        onChangeText={(text) => onChange(Number.parseInt(text.replace(/\D/g, ''), 10) || 0)}
        value={String(value)}
      />
      {stepButton('+', max !== undefined && value >= max, value + 1)}
    </View>
  );
}
