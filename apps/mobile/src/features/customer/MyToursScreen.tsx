import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import type { TourAppointmentRecord } from '@storage/types';
import { TourAppointmentStatus } from '@storage/types';
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
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import {
  AlertSheet,
  Button,
  colors,
  FlowScreen,
  InlineMessage,
  TabChip,
  Text,
} from '../../components/ui';
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
  error?: string | null;
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
  error,
  statusFilter,
  onFilterStatus,
  onRefresh,
  onCancelAppointment,
  onBrowse,
  onBack,
}: Props) {
  const cancelRef = useRef<BottomSheetModal>(null);
  const [pendingCancel, setPendingCancel] = useState<TourAppointmentRecord | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  const callPhone = (phone: string) => {
    setCallError(null);
    Linking.openURL(`tel:${phone}`).catch(() => {
      setCallError(`Không thể gọi tự động. Vui lòng quay số ${phone} thủ công.`);
    });
  };

  return (
    <FlowScreen muted onBack={onBack} title="Lịch hẹn xem kho" titleAlign="left">
      <View className="border-b border-border-default bg-bg-page py-2.5">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
        >
          {STATUS_FILTERS.map((s) => {
            const label = s === null ? 'Tất cả' : TOUR_STATUS_LABEL[s];
            return (
              <TabChip
                key={s ?? 'ALL'}
                label={label}
                onPress={() => onFilterStatus(s)}
                selected={statusFilter === s}
                tone="primary"
              />
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1 bg-bg-muted"
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
      >
        {error ? (
          <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
            <InlineMessage message={error} type="error" />
            <Button label="Thử lại" onPress={onRefresh} size="sm" variant="secondary" />
          </View>
        ) : null}

        {callError ? <InlineMessage message={callError} type="warning" /> : null}

        {isLoading && appointments.length === 0 ? (
          <ActivityIndicator color={colors.semantic.actionPrimary} />
        ) : null}

        {appointments.length === 0 && !isLoading && !error ? (
          <View className="items-center justify-center gap-3 rounded-[20px] border border-dashed border-border-strong bg-bg-card px-6 py-12">
            <View className="size-16 items-center justify-center rounded-full bg-secondary-0">
              <CalendarBlank color={colors.semantic.actionPrimary} size={30} />
            </View>
            <Text className="text-center text-body-lg font-bold text-text-primary">
              Chưa có lịch hẹn xem kho nào
            </Text>
            <Text className="text-center text-body-sm text-text-secondary">
              Bạn có thể xem trước hình ảnh, diện tích và đặt lịch hẹn đến tham quan trực tiếp bất
              cứ chi nhánh nào.
            </Text>
            <Button
              className="mt-1"
              label="Khám phá danh sách kho"
              onPress={onBrowse}
              variant="primary"
            />
          </View>
        ) : null}

        {appointments.map((apt) => {
          const isTerminal =
            apt.status === TourAppointmentStatus.COMPLETED ||
            apt.status === TourAppointmentStatus.CANCELLED;

          return (
            <View
              key={apt.id}
              className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4"
            >
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1 gap-1">
                  <View className="flex-row items-center gap-1.5">
                    <MapPin color={colors.semantic.iconBrand} size={16} weight="fill" />
                    <Text className="flex-1 text-body font-bold text-text-primary">
                      {apt.facility?.name ?? 'Chi nhánh'}
                    </Text>
                  </View>
                  {apt.storageUnit ? (
                    <View className="flex-row items-center gap-1.5 pl-5">
                      <Warehouse color={colors.semantic.textSecondary} size={14} />
                      <Text className="text-caption text-text-secondary">
                        Phòng kho:{' '}
                        <Text className="font-semibold text-text-primary">
                          {apt.storageUnit.name}
                        </Text>
                      </Text>
                    </View>
                  ) : null}
                </View>
                <StatusPill
                  label={TOUR_STATUS_LABEL[apt.status]}
                  tone={TOUR_STATUS_TONE[apt.status]}
                />
              </View>

              <View className="flex-row items-center gap-3 rounded-2xl bg-bg-subtle px-3.5 py-2.5">
                <View className="flex-1 flex-row items-center gap-1.5">
                  <CalendarCheck color={colors.semantic.actionPrimary} size={16} weight="bold" />
                  <Text className="text-body-sm font-medium text-text-primary tabular-nums">
                    {formatTourDate(apt.preferredDate)}
                  </Text>
                </View>
                <View className="h-4 w-px bg-border-divider" />
                <View className="flex-1 flex-row items-center gap-1.5">
                  <Clock color={colors.semantic.actionPrimary} size={16} weight="bold" />
                  <Text className="text-body-sm font-medium text-text-primary tabular-nums">
                    {apt.preferredTimeSlot || 'Chưa định giờ'}
                  </Text>
                </View>
              </View>

              {apt.assignee ? (
                <View className="flex-row items-center justify-between rounded-2xl border border-border-default bg-bg-subtle p-3">
                  <View className="flex-1 flex-row items-center gap-2.5">
                    <View className="size-9 items-center justify-center rounded-full bg-secondary-0">
                      <UserCheck color={colors.semantic.actionPrimary} size={16} weight="bold" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-overline text-text-secondary">Nhân viên đón tiếp</Text>
                      <Text className="text-body-sm font-semibold text-text-primary">
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
                      className="size-9 items-center justify-center rounded-full bg-secondary-0"
                    >
                      <Phone color={colors.semantic.actionPrimary} size={16} weight="fill" />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {apt.managerNotes ? (
                <View className="gap-0.5 rounded-xl bg-bg-subtle p-3">
                  <Text className="text-overline font-semibold text-text-secondary">
                    Ghi chú từ quản lý
                  </Text>
                  <Text className="text-caption text-text-primary">{apt.managerNotes}</Text>
                </View>
              ) : null}

              {apt.cancellationReason ? (
                <View className="gap-1 rounded-xl bg-warning-0 p-3">
                  <View className="flex-row items-center gap-1">
                    <XCircle color={colors.warning[700]} size={14} weight="bold" />
                    <Text className="text-overline font-semibold text-warning-700">Lý do hủy</Text>
                  </View>
                  <Text className="text-caption text-text-primary">{apt.cancellationReason}</Text>
                </View>
              ) : null}

              {!isTerminal ? (
                <View className="flex-row justify-end border-t border-border-divider pt-2.5">
                  <Button
                    label="Hủy lịch hẹn"
                    onPress={() => {
                      setPendingCancel(apt);
                      cancelRef.current?.present();
                    }}
                    size="sm"
                    variant="destructive"
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <AlertSheet
        ref={cancelRef}
        destructive
        message={
          pendingCancel
            ? `Bạn có chắc chắn muốn hủy lịch hẹn xem kho ngày ${formatTourDate(pendingCancel.preferredDate)}?`
            : undefined
        }
        onPrimary={() => {
          const target = pendingCancel;
          cancelRef.current?.dismiss();
          setPendingCancel(null);
          if (target) onCancelAppointment(target);
        }}
        onSecondary={() => {
          cancelRef.current?.dismiss();
          setPendingCancel(null);
        }}
        primaryLabel="Xác nhận hủy"
        secondaryLabel="Quay lại"
        title="Hủy lịch hẹn xem kho"
      />
    </FlowScreen>
  );
}
