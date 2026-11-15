import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

type Props = {
  badge?: number;
  icon: ReactNode;
  isSelected: boolean;
  label: string;
  onPress: () => void;
};

/** One item of a custom bottom tab bar styled after Medipay Navbar (`#007BB5` active, `#667783` idle). */
export function BottomTabButton({ badge, icon, isSelected, label, onPress }: Props) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: isSelected }}
      className="flex-1 items-center gap-1 pt-3"
      onPress={onPress}
    >
      <View>
        {icon}
        {badge && badge > 0 ? (
          <View className="absolute -top-1 -right-2.5 h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1">
            <Text className="font-inter text-[10px] leading-[12px] font-bold text-white">
              {badge > 9 ? '9+' : badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        className={`font-inter text-caption font-medium ${
          isSelected ? 'text-text-link' : 'text-text-secondary'
        }`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
