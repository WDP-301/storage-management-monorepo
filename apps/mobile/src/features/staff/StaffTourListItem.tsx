import type { TourAppointmentRecord } from '@storage/types';
import { useThemeColor } from 'heroui-native';
import { CalendarCheck, Clock, MapPin, Phone, User, Warehouse } from 'phosphor-react-native';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { StatusPill } from '../customer/contract-display';
import { formatTourDate, TOUR_STATUS_LABEL, TOUR_STATUS_TONE } from '../customer/tour-display';

type Props = {
  appointment: TourAppointmentRecord;
  onPress: () => void;
};

export function StaffTourListItem({ appointment, onPress }: Props) {
  const [accentColor, mutedColor] = useThemeColor(['accent', 'muted']);

  const callPhone = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Không thể thực hiện cuộc gọi', `Vui lòng quay số ${phone} thủ công.`);
    });
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="rounded-2xl border border-border bg-surface p-4 gap-3 shadow-xs active:opacity-85"
    >
      {/* Header: Customer Name + Status Badge */}
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-1.5">
            <User color={accentColor} size={16} weight="bold" />
            <Text className="font-strong text-body-md text-foreground flex-1">
              {appointment.fullName}
            </Text>
          </View>
          <Text className="font-numeric text-caption text-muted pl-5">{appointment.phone}</Text>
        </View>

        <View className="flex-row items-center gap-2">
          {appointment.phone && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Gọi khách hàng ${appointment.fullName}`}
              hitSlop={6}
              onPress={(e) => {
                e.stopPropagation();
                callPhone(appointment.phone);
              }}
              className="size-8 items-center justify-center rounded-full bg-accent/10 active:bg-accent/20"
            >
              <Phone color={accentColor} size={15} weight="fill" />
            </Pressable>
          )}
          <StatusPill
            label={TOUR_STATUS_LABEL[appointment.status]}
            tone={TOUR_STATUS_TONE[appointment.status]}
          />
        </View>
      </View>

      {/* Target Warehouse & Facility */}
      <View className="gap-1 rounded-xl bg-surface-secondary p-2.5">
        <View className="flex-row items-center gap-1.5">
          <MapPin color={accentColor} size={14} weight="fill" />
          <Text className="font-body text-caption text-foreground flex-1">
            {appointment.facility?.name ?? 'Chi nhánh'}
          </Text>
        </View>
        {appointment.storageUnit && (
          <View className="flex-row items-center gap-1.5 pl-4">
            <Warehouse color={mutedColor} size={14} />
            <Text className="font-body text-caption text-subtle">
              Phòng kho mẫu:{' '}
              <Text className="font-strong">
                {appointment.storageUnit.name} ({appointment.storageUnit.code})
              </Text>
            </Text>
          </View>
        )}
      </View>

      {/* Scheduled Date & Time */}
      <View className="flex-row items-center justify-between text-xs pt-1 border-t border-border/60">
        <View className="flex-row items-center gap-1.5">
          <CalendarCheck color={accentColor} size={15} weight="bold" />
          <Text className="font-numeric text-caption text-foreground">
            {formatTourDate(appointment.preferredDate)}
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5">
          <Clock color={accentColor} size={15} weight="bold" />
          <Text className="font-numeric text-caption text-foreground">
            {appointment.preferredTimeSlot || 'Chưa định giờ'}
          </Text>
        </View>
      </View>

      {/* Notes preview */}
      {appointment.customerNotes ? (
        <Text className="font-body text-[11px] text-muted italic" numberOfLines={1}>
          Khách dặn: "{appointment.customerNotes}"
        </Text>
      ) : null}
    </Pressable>
  );
}
