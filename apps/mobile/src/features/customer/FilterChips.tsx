import { Button } from 'heroui-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/**
 * Chip-style controls for the browse filters.
 *
 * Built on `Button` rather than `Chip` because the toggle states (`primary` / `secondary`) come
 * for free and match the mode switch already used elsewhere on the screen.
 */

export function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View>
      <Text className="text-xs font-ui text-muted">{label}</Text>
      <View className="mt-2 flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

export function ChipButton({
  label,
  isSelected,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Button size="sm" variant={isSelected ? 'primary' : 'secondary'} onPress={onPress}>
      <Button.Label className="font-ui">{label}</Button.Label>
    </Button>
  );
}
