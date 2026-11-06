import type { TourAppointmentRecord } from '@storage/types';
import { TourAppointmentStatus } from '@storage/types';
import { Button, useThemeColor } from 'heroui-native';
import {
  CalendarBlank,
  CalendarCheck,
  CheckCircle,
  Clock,
  Envelope,
  MapPin,
  Phone,
  User,
  Warehouse,
  XCircle,
} from 'phosphor-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusPill } from '../customer/contract-display';
import { formatTourDate, TOUR_STATUS_LABEL, TOUR_STATUS_TONE } from '../customer/tour-display';

type Props = {
  appointment: TourAppointmentRecord | null;
  isLoading: boolean;
  isSaving: boolean;
  onComplete: (notes: string) => Promise<void>;
  onCancel: (reason: string) => Promise<void>;
  onBack: () => void;
};

export function StaffTourDetailScreen({
  appointment,
  isLoading,
  isSaving,
  onComplete,
  onCancel,
  onBack,
}: Props) {
  const [accentColor, mutedColor] = useThemeColor(['accent', 'muted']);
  const [resultNotes, setResultNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelFormOpen, setIsCancelFormOpen] = useState(false);

  if (isLoading || !appointment) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Chi tiết ca dẫn khách" backLabel="Hôm nay" onBack={onBack} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </View>
    );
  }

  const isTerminal =
    appointment.status === TourAppointmentStatus.COMPLETED ||
    appointment.status === TourAppointmentStatus.CANCELLED;

  const handleCall = () => {
    Linking.openURL(`tel:${appointment.phone}`).catch(() => {
      Alert.alert(
        'Không thể thực hiện cuộc gọi',
        `Vui lòng quay số ${appointment.phone} thủ công.`,
      );
    });
  };

  const handleCompleteSubmit = () => {
    if (!resultNotes.trim() || resultNotes.trim().length < 5) {
      Alert.alert(
        'Thiếu ghi chú',
        'Vui lòng nhập ghi chú kết quả ca dẫn khách (tối thiểu 5 ký tự).',
      );
      return;
    }
    Alert.alert(
      'Xác nhận hoàn tất',
      'Bạn có chắc chắn muốn lưu kết quả và đánh dấu ca dẫn khách này đã hoàn thành?',
      [
        { text: 'Quay lại', style: 'cancel' },
        { text: 'Hoàn tất', onPress: () => void onComplete(resultNotes.trim()) },
      ],
    );
  };

  const handleCancelSubmit = () => {
    if (!cancelReason.trim()) {
      Alert.alert('Thiếu lý do', 'Vui lòng nhập lý do hủy ca hoặc lý do khách vắng mặt.');
      return;
    }
    Alert.alert(
      'Xác nhận hủy / Báo vắng',
      'Đánh dấu ca này là khách vắng mặt (No-show) hoặc hủy hẹn?',
      [
        { text: 'Quay lại', style: 'cancel' },
        {
          text: 'Xác nhận',
          style: 'destructive',
          onPress: () => void onCancel(cancelReason.trim()),
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Chi tiết ca dẫn khách" backLabel="Hôm nay" onBack={onBack} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Card 1: Customer Contact */}
        <View className="mb-4 rounded-2xl border border-border bg-surface p-4 gap-3 shadow-xs">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="size-10 items-center justify-center rounded-full bg-accent/10">
                <User color={accentColor} size={20} weight="bold" />
              </View>
              <View>
                <Text className="font-strong text-body-lg text-foreground">
                  {appointment.fullName}
                </Text>
                <Text className="font-body text-caption text-muted">Khách hàng tham quan</Text>
              </View>
            </View>

            <StatusPill
              label={TOUR_STATUS_LABEL[appointment.status]}
              tone={TOUR_STATUS_TONE[appointment.status]}
            />
          </View>

          <View className="h-px bg-separator" />

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2 flex-1">
              <Phone color={accentColor} size={16} weight="fill" />
              <Text className="font-numeric text-body-sm text-foreground">{appointment.phone}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={handleCall}
              className="flex-row items-center gap-1 rounded-full bg-accent px-3 py-1.5 active:opacity-85"
            >
              <Phone color="#fff" size={14} weight="fill" />
              <Text className="font-ui text-caption font-strong text-white">Gọi ngay</Text>
            </Pressable>
          </View>

          {appointment.email && (
            <View className="flex-row items-center gap-2">
              <Envelope color={mutedColor} size={16} />
              <Text className="font-body text-body-sm text-subtle">{appointment.email}</Text>
            </View>
          )}
        </View>

        {/* Card 2: Schedule & Facility Info */}
        <View className="mb-4 rounded-2xl border border-border bg-surface p-4 gap-3 shadow-xs">
          <Text className="font-strong text-body-md text-foreground">Thông tin ca tham quan</Text>

          <View className="flex-row items-center gap-2">
            <MapPin color={accentColor} size={18} weight="fill" />
            <Text className="font-strong text-body-sm text-foreground flex-1">
              {appointment.facility?.name ?? 'Chi nhánh'}
            </Text>
          </View>

          {appointment.storageUnit && (
            <View className="flex-row items-center gap-2 pl-6">
              <Warehouse color={mutedColor} size={16} />
              <Text className="font-body text-body-sm text-foreground">
                Phòng kho mẫu:{' '}
                <Text className="font-strong">
                  {appointment.storageUnit.name} ({appointment.storageUnit.code})
                </Text>
              </Text>
            </View>
          )}

          <View className="flex-row items-center gap-3 rounded-xl bg-surface-secondary p-3 mt-1">
            <View className="flex-row items-center gap-1.5 flex-1">
              <CalendarBlank color={accentColor} size={18} weight="bold" />
              <View>
                <Text className="font-body text-[11px] text-muted">Ngày hẹn</Text>
                <Text className="font-numeric text-body-sm text-foreground">
                  {formatTourDate(appointment.preferredDate)}
                </Text>
              </View>
            </View>

            <View className="h-6 w-px bg-separator" />

            <View className="flex-row items-center gap-1.5 flex-1">
              <Clock color={accentColor} size={18} weight="bold" />
              <View>
                <Text className="font-body text-[11px] text-muted">Khung giờ</Text>
                <Text className="font-numeric text-body-sm text-foreground">
                  {appointment.preferredTimeSlot || 'Chưa định giờ'}
                </Text>
              </View>
            </View>
          </View>

          {appointment.customerNotes && (
            <View className="rounded-xl border border-border bg-surface-secondary p-3 gap-1">
              <Text className="font-strong text-caption text-muted">Lời nhắn từ khách:</Text>
              <Text className="font-body text-body-sm text-foreground italic">
                "{appointment.customerNotes}"
              </Text>
            </View>
          )}

          {appointment.managerNotes && (
            <View className="rounded-xl border border-accent/20 bg-accent/5 p-3 gap-1">
              <Text className="font-strong text-caption text-accent">
                Dặn dò của Quản lý chi nhánh:
              </Text>
              <Text className="font-body text-body-sm text-foreground">
                {appointment.managerNotes}
              </Text>
            </View>
          )}
        </View>

        {/* Card 3: Completion Result (if already completed) */}
        {appointment.staffResultNotes && (
          <View className="mb-4 rounded-2xl border border-success/30 bg-success-bg/40 p-4 gap-2">
            <View className="flex-row items-center gap-2">
              <CheckCircle color="hsl(142 71% 35%)" size={20} weight="fill" />
              <Text className="font-strong text-body-md text-success">
                Kết quả ca tư vấn dẫn khách
              </Text>
            </View>
            <Text className="font-body text-body-sm text-foreground">
              {appointment.staffResultNotes}
            </Text>
          </View>
        )}

        {/* Card 4: Cancellation Reason (if cancelled) */}
        {appointment.cancellationReason && (
          <View className="mb-4 rounded-2xl border border-danger/30 bg-danger/5 p-4 gap-2">
            <View className="flex-row items-center gap-2">
              <XCircle color="hsl(0 72% 51%)" size={20} weight="fill" />
              <Text className="font-strong text-body-md text-danger">
                Lý do hủy / Báo vắng mặt (No-show)
              </Text>
            </View>
            <Text className="font-body text-body-sm text-foreground">
              {appointment.cancellationReason}
            </Text>
          </View>
        )}

        {/* Action Panel: When appointment is active */}
        {!isTerminal && (
          <View className="gap-4 mt-2">
            {/* Complete Tour Section */}
            <View className="rounded-2xl border border-border bg-surface p-4 gap-3 shadow-xs">
              <View className="flex-row items-center gap-2">
                <CalendarCheck color={accentColor} size={20} weight="bold" />
                <Text className="font-strong text-body-md text-foreground">
                  Ghi nhận kết quả sau ca dẫn
                </Text>
              </View>

              <Text className="font-body text-caption text-muted">
                Nhập phản hồi của khách, nhu cầu thuê và kết quả tư vấn để quản lý theo dõi.
              </Text>

              <TextInput
                className="min-h-24 rounded-xl border border-border bg-surface-secondary p-3 text-body-sm text-foreground font-body"
                placeholder="VD: Khách rất ưng ý diện tích kho mẫu U-101, dự kiến thuê 6 tháng bắt đầu từ tuần tới..."
                placeholderTextColor={mutedColor}
                multiline
                value={resultNotes}
                onChangeText={setResultNotes}
              />

              <Button
                variant="primary"
                isDisabled={isSaving || !resultNotes.trim()}
                onPress={handleCompleteSubmit}
              >
                <Button.Label className="font-ui font-strong">
                  {isSaving ? 'Đang lưu...' : 'Hoàn tất ca dẫn khách'}
                </Button.Label>
              </Button>
            </View>

            {/* Cancel / No-show Section */}
            {!isCancelFormOpen ? (
              <Button variant="ghost" onPress={() => setIsCancelFormOpen(true)}>
                <Button.Label className="font-ui text-danger text-body-sm">
                  Khách không đến / Hủy ca dẫn khách
                </Button.Label>
              </Button>
            ) : (
              <View className="rounded-2xl border border-warning/40 bg-surface p-4 gap-3">
                <Text className="font-strong text-body-sm text-foreground">
                  Lý do báo vắng (No-show) hoặc hủy ca:
                </Text>

                <View className="flex-row flex-wrap gap-1.5">
                  {['Khách hẹn lại hôm khác', 'Khách không bắt máy', 'Khách đổi ý không đến'].map(
                    (r) => (
                      <Pressable
                        key={r}
                        onPress={() => setCancelReason(r)}
                        className="rounded-full border border-border bg-surface-secondary px-2.5 py-1"
                      >
                        <Text className="font-body text-caption text-subtle">{r}</Text>
                      </Pressable>
                    ),
                  )}
                </View>

                <TextInput
                  className="min-h-16 rounded-xl border border-border bg-surface-secondary p-2.5 text-body-sm text-foreground font-body"
                  placeholder="Nhập chi tiết lý do..."
                  placeholderTextColor={mutedColor}
                  value={cancelReason}
                  onChangeText={setCancelReason}
                />

                <View className="flex-row gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => setIsCancelFormOpen(false)}
                    isDisabled={isSaving}
                  >
                    <Button.Label className="font-ui text-muted">Đóng</Button.Label>
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onPress={handleCancelSubmit}
                    isDisabled={isSaving || !cancelReason.trim()}
                  >
                    <Button.Label className="font-ui font-strong text-danger">
                      Xác nhận báo vắng
                    </Button.Label>
                  </Button>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
