import { Pressable, Text, View } from 'react-native';

/** Single-choice pill, dark when selected — used for time slots and rental duration. */
export function ChoiceChip({
  label,
  isSelected,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      onPress={onPress}
    >
      <View
        className={`rounded-full border px-3.5 py-2 ${
          isSelected ? 'border-foreground bg-foreground' : 'border-border bg-surface'
        }`}
      >
        <Text className={`font-ui text-body-sm ${isSelected ? 'text-surface' : 'text-subtle'}`}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
