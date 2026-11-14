import { Text, View } from 'react-native';
import { ChoiceChip } from '../../components/ChoiceChip';
import type { OfficeTimeSlots } from './use-office-time-slots';

/** "Giờ …" section: the day's OFFICE-shift hours as chips, or why there are none to pick. */
export function OfficeTimeChips({ label, slots }: { label: string; slots: OfficeTimeSlots }) {
  return (
    <View className="gap-2">
      <Text className="text-body-sm font-strong text-foreground">{label}</Text>
      {slots.dayIso === null ? (
        <Text className="font-body text-body-sm text-muted">Chọn ngày trước.</Text>
      ) : slots.isLoading ? (
        <Text className="font-body text-body-sm text-muted">Đang tải khung giờ…</Text>
      ) : slots.error !== null ? (
        <Text className="font-body text-body-sm text-danger">{slots.error}</Text>
      ) : slots.options.length === 0 ? (
        <Text className="font-body text-body-sm text-danger">
          Ngày này không còn khung giờ hành chính. Vui lòng chọn ngày khác.
        </Text>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {slots.options.map((option) => (
            <ChoiceChip
              key={option.value}
              isSelected={slots.chosen === option.value}
              label={option.label}
              onPress={() => slots.pick(option.value)}
            />
          ))}
        </View>
      )}
    </View>
  );
}
