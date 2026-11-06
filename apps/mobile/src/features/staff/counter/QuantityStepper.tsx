import { Pressable, Text, TextInput, View } from 'react-native';

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
  const button = (label: string, disabled: boolean, next: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '−' ? 'Giảm' : 'Tăng'}
      accessibilityState={{ disabled }}
      disabled={disabled}
      className={`h-9 w-9 items-center justify-center rounded-lg bg-surface-secondary ${disabled ? 'opacity-40' : ''}`}
      onPress={() => onChange(next)}
    >
      <Text className="font-strong text-body-md text-foreground">{label}</Text>
    </Pressable>
  );
  return (
    <View className="flex-row items-center gap-1.5">
      {button('−', value <= 0, value - 1)}
      <TextInput
        accessibilityLabel="Số lượng"
        keyboardType="number-pad"
        className="h-9 w-14 rounded-lg border border-border bg-surface text-center font-strong text-body-md text-foreground"
        value={String(value)}
        onChangeText={(text) => onChange(Number.parseInt(text.replace(/\D/g, ''), 10) || 0)}
      />
      {button('+', max !== undefined && value >= max, value + 1)}
    </View>
  );
}
