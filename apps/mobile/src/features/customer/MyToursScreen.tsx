import type { TourAppointmentRecord } from '@storage/types';
import { TourAppointmentStatus } from '@storage/types';
import { Button, useThemeColor } from 'heroui-native';
import {
  CalendarBlank,
  CalendarCheck,
  Clock,
  MapPin,
  Phone,
  UserCheck,
  Warehouse,
  XCircle,
} from 'phosphor-react-native';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { FilterPill } from '../../components/FilterPill';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusPill } from './contract-display';
import { formatTourDate, TOUR_STATUS_LABEL, TOUR_STATUS_TONE } from './tour-display';

const STATUS_FILTERS: (TourAppointmentStatus | null)[] = [
  null,
  TourAppointmentStatus.PENDING,
  TourAppointmentStatus.CONFIRMED,
  TourAppointmentStatus.ASSIGNED,
  TourAppointmentStatus.COMPLETED,
  TourAppointmentStatus.CANCELLED,
];

type Props = {
  appointments: TourAppointmentRecord[];
  isLoading: boolean;
  statusFilter: TourAppointmentStatus | null;
  onFilterStatus: (status: TourAppointmentStatus | null) => void;
  onRefresh: () => void;
  onCancelAppointment: (appointment: TourAppointmentRecord) => void;
  onBrowse: () => void;
  onBack: () => void;
};

export function MyToursScreen({
  appointments,
  isLoading,
  statusFilter,
  onFilterStatus,
  onRefresh,
  onCancelAppointment,
  onBrowse,
  onBack,
}: Props) {
  const [accentColor, mutedColor] = useThemeColor(['accent', 'muted']);

  const callPhone = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Không thể thực hiện cuộc gọi', `Vui lòng quay số ${phone} thủ công.`);
    });
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Lịch hẹn xem kho" backLabel="Quay lại Tài khoản" onBack={onBack} />

      {/* Filter Tabs */}
      <View className="border-b border-border py-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-4"
        >
          {STATUS_FILTERS.map((s) => {
            const isSelected = statusFilter === s;
            const label = s === null ? 'Tất cả' : TOUR_STATUS_LABEL[s];
            return (
              <FilterPill
                key={s ?? 'ALL'}
                label={label}
                isSelected={isSelected}
                onPress={() => onFilterStatus(s)}
              />
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
      >
        {appointments.length === 0 && !isLoading ? (
          <View className="items-center justify-center py-16 px-6 gap-3">
            <View className="size-16 items-center justify-center rounded-full bg-surface-secondary">
              <CalendarBlank color={mutedColor} size={32} />
            </View>
            <Text className="font-strong text-body-lg text-foreground text-center">
              Chưa có lịch hẹn xem kho nào
            </Text>
            <Text className="font-body text-body-sm text-muted text-center">
              Bạn có thể xem trước hình ảnh, diện tích và đặt lịch hẹn đến tham quan trực tiếp bất
              cứ chi nhánh nào.
            </Text>
            <Button variant="primary" onPress={onBrowse} className="mt-2">
              <Button.Label className="font-ui">Khám phá danh sách kho</Button.Label>
            </Button>
          </View>
        ) : null}

        <View className="gap-3">
          {appointments.map((apt) => {
            const isTerminal =
              apt.status === TourAppointmentStatus.COMPLETED ||
              apt.status === TourAppointmentStatus.CANCELLED;

            return (
              <View
                key={apt.id}
                className="rounded-2xl border border-border bg-surface p-4 gap-3 shadow-xs"
              >
                {/* Header row: Facility + Status */}
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1 gap-1">
                    <View className="flex-row items-center gap-1.5">
                      <MapPin color={accentColor} size={16} weight="fill" />
                      <Text className="font-strong text-body-md text-foreground flex-1">
                        {apt.facility?.name ?? 'Chi nhánh'}
                      </Text>
                    </View>
                    {apt.storageUnit && (
                      <View className="flex-row items-center gap-1 pl-5">
                        <Warehouse color={mutedColor} size={14} />
                        <Text className="font-body text-caption text-subtle">
                          Phòng kho:{' '}
                          <Text className="font-strong">
                            {apt.storageUnit.name} ({apt.storageUnit.code})
                          </Text>
                        </Text>
                      </View>
                    )}
                  </View>
                  <StatusPill
                    label={TOUR_STATUS_LABEL[apt.status]}
                    tone={TOUR_STATUS_TONE[apt.status]}
                  />
                </View>

                {/* Scheduled Date and Time */}
                <View className="flex-row items-center gap-3 rounded-xl bg-surface-secondary px-3 py-2.5">
                  <View className="flex-row items-center gap-1.5 flex-1">
                    <CalendarCheck color={accentColor} size={16} weight="bold" />
                    <Text className="font-numeric text-body-sm text-foreground">
                      {formatTourDate(apt.preferredDate)}
                    </Text>
                  </View>
                  <View className="h-4 w-px bg-separator" />
                  <View className="flex-row items-center gap-1.5 flex-1">
                    <Clock color={accentColor} size={16} weight="bold" />
                    <Text className="font-numeric text-body-sm text-foreground">
                      {apt.preferredTimeSlot || 'Chưa định giờ'}
                    </Text>
                  </View>
                </View>

                {/* Staff Guide (if assigned) */}
                {apt.assignee ? (
                  <View className="flex-row items-center justify-between rounded-xl border border-border/80 p-2.5 bg-surface-secondary/50">
                    <View className="flex-row items-center gap-2 flex-1">
                      <View className="size-8 items-center justify-center rounded-full bg-accent/10">
                        <UserCheck color={accentColor} size={16} weight="bold" />
                      </View>
                      <View className="flex-1">
                        <Text className="font-body text-[11px] text-muted">Nhân viên đón tiếp</Text>
                        <Text className="font-strong text-body-sm text-foreground">
                          {apt.assignee.fullName}
                        </Text>
                      </View>
                    </View>
                    {apt.assignee?.phone ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Gọi nhân viên ${apt.assignee.fullName}`}
                        onPress={() => {
                          const phone = apt.assignee?.phone;
                          if (phone) callPhone(phone);
                        }}
                        className="size-8 items-center justify-center rounded-full bg-accent/15"
                      >
                        <Phone color={accentColor} size={16} weight="fill" />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {/* Manager Notes (if any) */}
                {apt.managerNotes && (
                  <View className="rounded-lg bg-surface-secondary p-2.5 gap-0.5">
                    <Text className="font-strong text-[11px] text-muted">Ghi chú từ quản lý:</Text>
                    <Text className="font-body text-caption text-foreground">
                      {apt.managerNotes}
                    </Text>
                  </View>
                )}

                {/* Cancellation Reason */}
                {apt.cancellationReason && (
                  <View className="rounded-lg bg-warning-bg/40 p-2.5 gap-0.5">
                    <View className="flex-row items-center gap-1">
                      <XCircle color="hsl(32 95% 44%)" size={14} weight="bold" />
                      <Text className="font-strong text-[11px] text-warning">Lý do hủy:</Text>
                    </View>
                    <Text className="font-body text-caption text-foreground">
                      {apt.cancellationReason}
                    </Text>
                  </View>
                )}

                {/* Footer Action: Cancel button if active */}
                {!isTerminal && (
                  <View className="pt-2 border-t border-border flex-row justify-end">
                    <Button variant="ghost" size="sm" onPress={() => onCancelAppointment(apt)}>
                      <Button.Label className="font-ui text-danger text-caption">
                        Hủy lịch hẹn
                      </Button.Label>
                    </Button>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
