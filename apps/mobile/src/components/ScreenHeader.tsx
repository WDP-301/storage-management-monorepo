import { ArrowLeft } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

const ACCENT = 'hsl(203 100% 30%)';

/** Back arrow + title for screens pushed on top of a tab, matching the booking flow headers. */
export function ScreenHeader({
  title,
  backLabel,
  onBack,
  right,
}: {
  title: string;
  /** Accessible name of the back button, e.g. "Quay lại Tài khoản". */
  backLabel: string;
  onBack: () => void;
  right?: ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3 px-4 pt-5 pb-3">
      <View className="flex-1 flex-row items-center gap-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          onPress={onBack}
        >
          <View className="size-10 items-center justify-center rounded-full">
            <ArrowLeft color={ACCENT} size={22} weight="bold" />
          </View>
        </Pressable>
        <Text className="flex-1 font-strong text-foreground text-title-md" numberOfLines={1}>
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}
