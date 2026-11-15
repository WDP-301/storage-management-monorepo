import { View } from 'react-native';

import { Text } from './text';

export type StatusTone = 'info' | 'pending' | 'warning' | 'success' | 'neutral' | 'danger';

const TONE_CLASSES: Record<StatusTone, { bg: string; dot: string; text: string }> = {
  info: { bg: 'bg-info-0', dot: 'bg-action-primary', text: 'text-status-info' },
  pending: { bg: 'bg-warning-0', dot: 'bg-warning-700', text: 'text-warning-700' },
  warning: { bg: 'bg-warning-0', dot: 'bg-warning-700', text: 'text-warning-700' },
  success: { bg: 'bg-success-0', dot: 'bg-status-success', text: 'text-status-success' },
  neutral: { bg: 'bg-bg-subtle', dot: 'bg-text-secondary', text: 'text-text-secondary' },
  danger: { bg: 'bg-danger-0', dot: 'bg-status-danger', text: 'text-status-danger' },
};

type Props = {
  label: string;
  tone?: StatusTone;
  className?: string;
  testID?: string;
};

/** Status pill with colored indicator dot and semantic tint (Medipay History/Booking pattern). */
export function StatusPill({ label, tone = 'neutral', className = '', testID }: Props) {
  const style = TONE_CLASSES[tone];
  return (
    <View
      className={`flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1 ${style.bg} ${className}`}
      testID={testID}
    >
      <View className={`size-1.5 rounded-full ${style.dot}`} />
      <Text className={`text-caption font-semibold ${style.text}`} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
