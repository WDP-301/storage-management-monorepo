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
      <Text className="text-xs font-medium text-muted">{label}</Text>
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
      <Button.Label>{label}</Button.Label>
    </Button>
  );
}

/**
 * A narrowing option earns its place only when it actually narrows: it must match something, and
 * match less than the unfiltered total. A bucket equal to the total is a no-op — showing it makes
 * the customer read a number that buys them nothing.
 *
 * The selected option always stays visible, otherwise choosing a bucket that turns out useless
 * would remove the very chip needed to undo it.
 */
export function isNarrowingChipVisible(count: number, total: number, isSelected: boolean): boolean {
  return isSelected || (count > 0 && count < total);
}

export function withCount(label: string, count: number): string {
  return `${label} (${count})`;
}
