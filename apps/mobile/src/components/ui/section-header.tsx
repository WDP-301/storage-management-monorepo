import { Pressable, View } from 'react-native';

import colors from './colors';
import { Icon } from './icon';
import { Text } from './text';

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  actionTestID?: string;
  className?: string;
};

/** Section heading row with an optional brand-link action on the right. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  actionTestID,
  className = '',
}: Props) {
  return (
    <View className={`flex-row items-center justify-between ${className}`}>
      <Text className="text-lead font-bold text-text-primary">{title}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          className="flex-row items-center gap-0.5"
          hitSlop={12}
          onPress={onAction}
          testID={actionTestID}
        >
          <Text className="text-body font-medium text-text-link">{actionLabel}</Text>
          <Icon color={colors.semantic.textLink} name="chevron-right" size={18} />
        </Pressable>
      ) : null}
    </View>
  );
}
