import { Pressable, Text, View } from 'react-native';

/** Single-choice filter pill: dark when selected, like the area presets on the browse screen. */
export function FilterPill({
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
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      onPress={onPress}
    >
      <View
        className={`rounded-full px-3.5 py-2 ${isSelected ? 'bg-foreground' : 'bg-surface-secondary'}`}
      >
        <Text
          className={`font-ui text-body-sm ${isSelected ? 'text-accent-foreground' : 'text-subtle'}`}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
