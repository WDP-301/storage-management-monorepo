import { View } from 'react-native';
import { InlineMessage, TabChip, Text } from '../../components/ui';
import type { OfficeTimeSlots } from './use-office-time-slots';

/** "Giờ …" section: the day's OFFICE-shift hours as chips, or why there are none to pick. */
export function OfficeTimeChips({ label, slots }: { label: string; slots: OfficeTimeSlots }) {
  return (
    <View className="gap-2.5">
      <Text className="text-body-sm font-semibold text-text-primary">{label}</Text>
      {slots.dayIso === null ? (
        <Text className="text-body-sm text-text-secondary">Chọn ngày trước.</Text>
      ) : slots.isLoading ? (
        <Text className="text-body-sm text-text-secondary">Đang tải khung giờ…</Text>
      ) : slots.error !== null ? (
        <InlineMessage message={slots.error} type="error" />
      ) : slots.options.length === 0 ? (
        <InlineMessage
          message="Ngày này không còn khung giờ hành chính. Vui lòng chọn ngày khác."
          type="error"
        />
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {slots.options.map((option) => (
            <TabChip
              key={option.value}
              label={option.label}
              selected={slots.chosen === option.value}
              onPress={() => slots.pick(option.value)}
            />
          ))}
        </View>
      )}
    </View>
  );
}
