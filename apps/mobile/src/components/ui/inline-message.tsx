import { View } from 'react-native';

import colors from './colors';
import { Icon, type IconName } from './icon';
import { Text } from './text';

export type InlineMessageType = 'error' | 'success' | 'info' | 'warning';

const MESSAGE_CONFIG: Record<
  InlineMessageType,
  { icon: IconName; color: string; className: string }
> = {
  error: { icon: 'error', color: colors.semantic.statusDanger, className: 'text-status-danger' },
  success: {
    icon: 'check-circle',
    color: colors.semantic.statusSuccess,
    className: 'text-status-success',
  },
  info: { icon: 'info', color: colors.semantic.statusInfo, className: 'text-status-info' },
  warning: { icon: 'warning', color: colors.warning[700], className: 'text-warning-700' },
};

type Props = {
  type?: InlineMessageType;
  message: string;
  className?: string;
  testID?: string;
};

/** Compact inline feedback row with an icon and semantic text tone. */
export function InlineMessage({ type = 'error', message, className = '', testID }: Props) {
  const { icon, color, className: textClassName } = MESSAGE_CONFIG[type];
  return (
    <View className={`flex-row items-center gap-1.5 ${className}`} testID={testID}>
      <Icon color={color} name={icon} size={16} />
      <Text className={`shrink text-caption ${textClassName}`}>{message}</Text>
    </View>
  );
}
