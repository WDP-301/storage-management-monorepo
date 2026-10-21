import { useThemeColor } from 'heroui-native';
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
import { Pressable, Text, View } from 'react-native';
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
  accent: 'bg-accent/10',
  success: 'bg-success-bg',
  warning: 'bg-warning-bg',
  danger: 'bg-danger-bg',
  neutral: 'bg-surface-secondary',
};

type Props = {
  notification: NotificationRecord;
  onPress: () => void;
};

export function NotificationRow({ notification, onPress }: Props) {
  const [accent, success, warning, danger, muted] = useThemeColor([
    'accent',
    'success',
    'warning',
    'danger',
    'muted',
  ]);
  const toneColor: Record<NotificationTone, string> = {
    accent,
    success,
    warning,
    danger,
    neutral: muted,
  };
  const display = notificationDisplay(notification.type);
  const IconComponent = ICONS[display.icon];
  const isUnread = notification.read_at === null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${isUnread ? 'Chưa đọc. ' : ''}${notification.title}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      onPress={onPress}
    >
      <View
        className={`flex-row gap-3 rounded-xl border p-3 ${
          isUnread ? 'border-accent/30 bg-surface' : 'border-border bg-surface'
        }`}
      >
        <View
          className={`size-10 items-center justify-center rounded-full ${TONE_BACKGROUND[display.tone]}`}
        >
          <IconComponent color={toneColor[display.tone]} size={20} />
        </View>
        <View className="flex-1 gap-1">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="font-ui flex-1 text-caption text-muted" numberOfLines={1}>
              {display.label}
            </Text>
            <Text className="font-body text-caption text-muted">
              {formatRelativeTime(notification.created_at)}
            </Text>
          </View>
          <View className="flex-row items-start gap-2">
            <Text
              className={`flex-1 text-body-md text-foreground ${
                isUnread ? 'font-strong' : 'font-body'
              }`}
              numberOfLines={2}
            >
              {notification.title}
            </Text>
            {isUnread ? <View className="mt-1.5 size-2.5 rounded-full bg-accent" /> : null}
          </View>
          <Text className="font-body text-body-sm text-muted" numberOfLines={2}>
            {notification.body}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
