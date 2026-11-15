import type { TourAppointmentRecord } from '@storage/types';
import { CalendarCheck, Clock, MapPin, Phone, User, Warehouse } from 'phosphor-react-native';
import { Linking, Pressable, View } from 'react-native';
import { colors, Dashed, Text } from '../../components/ui';
import { StatusPill } from '../customer/contract-display';
import { formatTourDate, TOUR_STATUS_LABEL, TOUR_STATUS_TONE } from '../customer/tour-display';

type Props = {
  appointment: TourAppointmentRecord;
  onPress: () => void;
};

export function StaffTourListItem({ appointment, onPress }: Props) {
  const callPhone = (phone: string) => {
    void Linking.openURL(`tel:${phone}`).catch(() => undefined);
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
      className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4"
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-1.5">
            <User color={colors.semantic.actionPrimary} size={16} weight="bold" />
            <Text className="flex-1 text-body font-bold text-text-primary">
              {appointment.fullName}
            </Text>
          </View>
          <Text className="pl-5 text-caption text-text-secondary tabular-nums">
            {appointment.phone}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          {appointment.phone ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Gọi khách hàng ${appointment.fullName}`}
              hitSlop={6}
              onPress={(e) => {
                e.stopPropagation();
                callPhone(appointment.phone);
              }}
              className="size-8 items-center justify-center rounded-full bg-secondary-0"
            >
              <Phone color={colors.semantic.actionPrimary} size={15} weight="fill" />
            </Pressable>
          ) : null}
          <StatusPill
            label={TOUR_STATUS_LABEL[appointment.status]}
            tone={TOUR_STATUS_TONE[appointment.status]}
          />
        </View>
      </View>

      <View className="gap-1.5 rounded-2xl bg-bg-subtle p-3">
        <View className="flex-row items-center gap-1.5">
          <MapPin color={colors.semantic.iconBrand} size={14} weight="fill" />
          <Text className="flex-1 text-caption text-text-primary">
            {appointment.facility?.name ?? 'Chi nhánh'}
          </Text>
        </View>
        {appointment.storageUnit ? (
          <View className="flex-row items-center gap-1.5 pl-4">
            <Warehouse color={colors.semantic.textSecondary} size={14} />
            <Text className="text-caption text-text-secondary">
              Phòng kho mẫu:{' '}
              <Text className="font-semibold text-text-primary">
                {appointment.storageUnit.name} ({appointment.storageUnit.code})
              </Text>
            </Text>
          </View>
        ) : null}
      </View>

      <Dashed />

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <CalendarCheck color={colors.semantic.actionPrimary} size={15} weight="bold" />
          <Text className="text-caption font-medium text-text-primary tabular-nums">
            {formatTourDate(appointment.preferredDate)}
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5">
          <Clock color={colors.semantic.actionPrimary} size={15} weight="bold" />
          <Text className="text-caption font-medium text-text-primary tabular-nums">
            {appointment.preferredTimeSlot || 'Chưa định giờ'}
          </Text>
        </View>
      </View>

      {appointment.customerNotes ? (
        <Text className="text-caption italic text-text-secondary" numberOfLines={1}>
          Khách dặn: "{appointment.customerNotes}"
        </Text>
      ) : null}
    </Pressable>
  );
}
