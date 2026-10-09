import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

type Props = {
  badge?: number;
  icon: ReactNode;
  isSelected: boolean;
  label: string;
  onPress: () => void;
};

/** One item of a custom bottom tab bar; shared by the customer and staff areas. */
export function BottomTabButton({ badge, icon, isSelected, label, onPress }: Props) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: isSelected }}
      className="min-h-14 flex-1 items-center justify-center gap-1"
      onPress={onPress}
    >
      <View>
        {icon}
        {badge ? (
          <View className="absolute -right-3 -top-2 min-w-5 items-center rounded-full bg-accent px-1">
            <Text className="text-[10px] font-display text-accent-foreground">{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text className={isSelected ? 'text-xs font-display text-accent' : 'text-xs text-muted'}>
        {label}
      </Text>
    </Pressable>
  );
}
