import {
  ArrowUUpLeft,
  Bell,
  CalendarBlank,
  CheckCircle,
  HandCoins,
  type Icon,
  Receipt,
  Scales,
  Ticket,
  WarningCircle,
} from 'phosphor-react-native';
import { Pressable, View } from 'react-native';
import { colors, Text } from '../../components/ui';
import type { NotificationRecord } from '../../types/notification-api';
import {
  formatRelativeTime,
  type NotificationIconKey,
  type NotificationTone,
  notificationDisplay,
} from './notification-display';

const ICONS: Record<NotificationIconKey, Icon> = {
  ticket: Ticket,
  invoice: Receipt,
  paid: CheckCircle,
  return: ArrowUUpLeft,
  settlement: Scales,
  refund: HandCoins,
  ending: CalendarBlank,
  overdue: WarningCircle,
  default: Bell,
};

const TONE_BACKGROUND: Record<NotificationTone, string> = {
  accent: 'bg-secondary-0',
  success: 'bg-success-0',
  warning: 'bg-warning-0',
  danger: 'bg-danger-0',
  neutral: 'bg-bg-subtle',
};

const TONE_ICON_COLOR: Record<NotificationTone, string> = {
  accent: colors.semantic.actionPrimary,
  success: colors.semantic.statusSuccess,
  warning: colors.warning[700],
  danger: colors.semantic.statusDanger,
  neutral: colors.semantic.textSecondary,
};

type Props = {
  notification: NotificationRecord;
  onPress: () => void;
};

export function NotificationRow({ notification, onPress }: Props) {
  const display = notificationDisplay(notification.type);
  const IconComponent = ICONS[display.icon];
  const isUnread = notification.read_at === null;

  return (
    <Pressable
      accessibilityLabel={`${isUnread ? 'Chưa đọc. ' : ''}${notification.title}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
    >
      <View
        className={`flex-row gap-3 rounded-2xl bg-bg-card p-4 ${
          isUnread ? 'border border-secondary-200' : ''
        }`}
      >
        <View
          className={`size-10 items-center justify-center rounded-full ${TONE_BACKGROUND[display.tone]}`}
        >
          <IconComponent color={TONE_ICON_COLOR[display.tone]} size={20} />
        </View>
        <View className="flex-1 gap-1">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-caption font-medium text-text-secondary" numberOfLines={1}>
              {display.label}
            </Text>
            <Text className="text-caption text-text-placeholder">
              {formatRelativeTime(notification.created_at)}
            </Text>
          </View>
          <View className="flex-row items-start gap-2">
            <Text
              className={`flex-1 text-body text-text-primary ${
                isUnread ? 'font-semibold' : 'font-normal'
              }`}
              numberOfLines={2}
            >
              {notification.title}
            </Text>
            {isUnread ? <View className="mt-1.5 size-2 rounded-full bg-action-primary" /> : null}
          </View>
          <Text className="text-caption text-text-secondary" numberOfLines={2}>
            {notification.body}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
