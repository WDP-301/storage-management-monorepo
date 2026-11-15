import type { ReactNode } from 'react';
import { View } from 'react-native';
import { TabChip, Text } from '../../components/ui';

export function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View>
      <Text className="text-caption font-semibold text-text-secondary uppercase">{label}</Text>
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
  return <TabChip label={label} onPress={onPress} selected={isSelected} tone="primary" />;
}
